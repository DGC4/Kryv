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

const source = await readFile(generatedClientPath, "utf8");
const normalized = source.replace(
  /query\?\s*:\s*UseQueryOptions<([\s\S]*?)>,\s*request\?\s*:/g,
  "query?: Omit<UseQueryOptions<$1>, 'queryKey' | 'queryFn'> & { queryKey?: QueryKey }, request?:",
);

if (normalized === source) {
  throw new Error("No generated React Query option signatures were normalized.");
}

await writeFile(generatedClientPath, normalized);
