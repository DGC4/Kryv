import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const generatedClientPath = resolve(
  process.cwd(),
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.ts",
);
const generatedTypesDirectory = resolve(
  process.cwd(),
  "..",
  "api-zod",
  "src",
  "generated",
  "types",
);
const generatedTypesIndexPath = resolve(generatedTypesDirectory, "index.ts");
const generatedZodPath = resolve(
  process.cwd(),
  "..",
  "api-zod",
  "src",
  "generated",
  "api.ts",
);

const [source, typesIndex, zodSource, typeFileNames] = await Promise.all([
  readFile(generatedClientPath, "utf8"),
  readFile(generatedTypesIndexPath, "utf8"),
  readFile(generatedZodPath, "utf8"),
  readdir(generatedTypesDirectory),
]);
const normalized = source.replace(
  /query\?\s*:\s*UseQueryOptions<([\s\S]*?)>,\s*request\?\s*:/g,
  "query?: Omit<UseQueryOptions<$1>, 'queryKey' | 'queryFn'> & { queryKey?: QueryKey }, request?:",
);
const validatorNames = new Set(
  [...zodSource.matchAll(/^export const ([A-Za-z0-9_]+)/gm)].map(
    ([, name]) => name,
  ),
);
const typeEntries = await Promise.all(
  typeFileNames
    .filter((fileName) => fileName.endsWith(".ts") && fileName !== "index.ts")
    .map(async (fileName) => [
      fileName.slice(0, -3),
      await readFile(resolve(generatedTypesDirectory, fileName), "utf8"),
    ]),
);
const collidingTypeModules = new Set(
  typeEntries.flatMap(([moduleName, typeSource]) => {
    const exportedName = typeSource.match(
      /^export (?:interface|type) ([A-Za-z0-9_]+)/m,
    )?.[1];
    return exportedName && validatorNames.has(exportedName) ? [moduleName] : [];
  }),
);
const normalizedTypesIndex = typesIndex.replace(
  /^export \* from '\.\/([^']+)';\r?\n/gm,
  (entry, moduleName) => (collidingTypeModules.has(moduleName) ? "" : entry),
);

if (normalized === source && normalizedTypesIndex === typesIndex) {
  throw new Error("No generated contract outputs required normalization.");
}

await Promise.all([
  writeFile(generatedClientPath, normalized),
  writeFile(generatedTypesIndexPath, normalizedTypesIndex),
]);
