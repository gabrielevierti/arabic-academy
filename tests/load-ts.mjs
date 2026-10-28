import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
export function load(file) {
  const source = readFileSync(file, "utf8").replaceAll(
    "import.meta.env.BASE_URL",
    "'./'",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const m = { exports: {} };
  new Function("exports", "module", "require", code)(m.exports, m, (id) =>
    id.startsWith(".")
      ? load(path.resolve(path.dirname(file), id + ".ts"))
      : require(id),
  );
  return m.exports;
}
