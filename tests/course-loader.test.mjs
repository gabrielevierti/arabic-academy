import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import ts from'typescript';
const code=ts.transpileModule(readFileSync('lib/course-loader.ts','utf8').replaceAll('import.meta.env.BASE_URL',"'/arabic-academy/'"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function make(fetch){const m={exports:{}};new Function('exports','module','fetch',code)(m.exports,m,fetch);return m.exports.loadCourse}
test('Course requests use the selected language and preserve Pages base path',async()=>{
 const urls=[];const load=make(async u=>{urls.push(u);return{ok:true,json:async()=>({url:u})}});
 const a=await load('A0-L0-01','it');const b=await load('A0-L0-01','en');assert.notEqual(a.url,b.url);
 assert.deepEqual(urls,['/arabic-academy/course/A0-L0-01.json','/arabic-academy/course/en/A0-L0-01.json']);await load('A0-L0-01','en');assert.equal(urls.length,2);
});
test('Failed English request is retryable and never silently returns Italian',async()=>{
 let count=0;const load=make(async()=>({ok:++count>1,json:async()=>({language:'en'})}));await assert.rejects(load('A0-L0-01','en'));assert.equal((await load('A0-L0-01','en')).language,'en');
});
