import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const generatedClientPath = resolve(
  process.cwd(),
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.ts",
);
const generatedTypesIndexPath = resolve(
  process.cwd(),
  "..",
  "api-zod",
  "src",
  "generated",
  "types",
  "index.ts",
);

const [source, typesIndex] = await Promise.all([
  readFile(generatedClientPath, "utf8"),
  readFile(generatedTypesIndexPath, "utf8"),
]);
const normalized = source.replace(
  /query\?\s*:\s*UseQueryOptions<([\s\S]*?)>,\s*request\?\s*:/g,
  "query?: Omit<UseQueryOptions<$1>, 'queryKey' | 'queryFn'> & { queryKey?: QueryKey }, request?:",
);
const normalizedTypesIndex = typesIndex
  .replace(/^export \* from '\.\/selectViewerProfileBody';\r?\n/m, "")
  .replace(/^export \* from '\.\/updateViewerProfilePinBody';\r?\n/m, "");

if (normalized === source && normalizedTypesIndex === typesIndex) {
  throw new Error("No generated contract outputs required normalization.");
}

await Promise.all([
  writeFile(generatedClientPath, normalized),
  writeFile(generatedTypesIndexPath, normalizedTypesIndex),
]);
