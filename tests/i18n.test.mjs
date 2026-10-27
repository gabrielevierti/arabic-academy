import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const en=JSON.parse(readFileSync('locales/en.json','utf8'));
let source=readFileSync('lib/i18n.tsx','utf8').replace("import en from '../locales/en.json';",'const en='+JSON.stringify(en)+';').replaceAll('import.meta.env.BASE_URL',"'./'");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
function runtime(saved,blocked=false){
 const stored=new Map(saved?[['arabic-academy:language:./',saved]]:[]), events={};
 const document={documentElement:{lang:''},title:''};const module={exports:{}};
 const storage={getItem:k=>{if(blocked)throw Error();return stored.get(k)||null},setItem:(k,v)=>{if(blocked)throw Error();stored.set(k,v)}};
 new Function('require','exports','module','localStorage','document','window',code)(()=>({useSyncExternalStore:()=>{}}),module.exports,module,storage,document,{addEventListener:(k,v)=>events[k]=v});
 return {api:module.exports,document,stored,events};
}
test('Italian default and English switch preserve arbitrary Arabic and personal text',()=>{
 const {api,document,stored}=runtime();assert.equal(api.tr('Il percorso'),'Il percorso');assert.equal(document.documentElement.lang,'it');
 api.setLanguage('en');assert.equal(api.tr('Il percorso'),'Learning path');assert.equal(api.tr('بَاب'),'بَاب');assert.equal(api.tr('My own note'),'My own note');assert.equal(api.tr('  Impara '),'  Learn ');assert.equal(document.documentElement.lang,'en');assert.equal(stored.get('arabic-academy:language:./'),'en');
 api.setLanguage('it');assert.equal(api.tr('Il percorso'),'Il percorso');
});
test('Saved choice survives reload; unknown choice falls back to Italian',()=>{assert.equal(runtime('en').api.tr('Impara'),'Learn');assert.equal(runtime('xx').api.tr('Impara'),'Impara')});
test('Blocked storage does not prevent switching',()=>{const r=runtime(null,true);r.api.setLanguage('en');assert.equal(r.api.tr('Impara'),'Learn')});
test('English dictionary has nonempty translations',()=>{for(const [key,value]of Object.entries(en)){assert(key.trim());assert(value.trim())}});
