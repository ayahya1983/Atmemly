import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, "..", "api-zod", "src", "index.ts");

const content = `// This file is overwritten by lib/api-spec/fix-api-zod-index.mjs after orval runs.
// Orval re-exports both ./generated/api (zod schemas, which are values + types via typeof)
// and ./generated/types (TS interfaces), causing TS2308 duplicate-export errors for body
// schemas. We only need the zod schemas — the api-server validates with .safeParse()/.parse()
// and infers TS types from those schemas via z.infer or typeof Schema._type.
export * from "./generated/api";
`;

writeFileSync(indexPath, content);
console.log("[fix-api-zod-index] rewrote", indexPath);
