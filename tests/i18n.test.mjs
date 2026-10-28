import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
let source = readFileSync("lib/i18n.tsx", "utf8")
  .replace(
    /import en from ['"]\.\.\/locales\/en\.json['"];?/,
    "const en=" + JSON.stringify(en) + ";",
  )
  .replaceAll("import.meta.env.BASE_URL", "'./'");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
function runtime(saved, blocked = false) {
  const stored = new Map(saved ? [["arabic-academy:language:./", saved]] : []),
    events = {};
  const document = { documentElement: { lang: "" }, title: "" };
  const module = { exports: {} };
  const storage = {
    getItem: (k) => {
      if (blocked) throw Error();
      return stored.get(k) || null;
    },
    setItem: (k, v) => {
      if (blocked) throw Error();
      stored.set(k, v);
    },
  };
  new Function(
    "require",
    "exports",
    "module",
    "localStorage",
    "document",
    "window",
    code,
  )(
    () => ({ useSyncExternalStore: () => {} }),
    module.exports,
    module,
    storage,
    document,
    { addEventListener: (k, v) => (events[k] = v) },
  );
  return { api: module.exports, document, stored, events };
}
test("Italian interface preserves Arabic and personal text", () => {
 const {api,document}=runtime();
 assert.equal(api.useLanguage(),"it");
 for(const text of ["Il percorso","بَاب","My own note","  Impara "]) assert.equal(api.tr(text),text);
 assert.equal(document.documentElement.lang,"it");
});
test("Legacy English preference cannot reactivate English",()=>{
 assert.equal(runtime("en").api.useLanguage(),"it");
 assert.equal(runtime("en").api.tr("Impara"),"Impara");
});
test("Italian interface works with unavailable storage",()=>{
 assert.equal(runtime("en",true).api.useLanguage(),"it");
});
test("Archived translation dictionary retains nonempty entries",()=>{
 for(const [key,value] of Object.entries(en)){assert(key.trim());assert(value.trim());}
});
