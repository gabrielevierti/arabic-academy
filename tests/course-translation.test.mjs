import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const arabic=s=>(s.match(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/gu)||[]).join('');
const readable=new Set(['title','text','prompt','instruction','model','explanation','rows','answers','tokens','description']);
function compare(a,b,path='',key=''){
 if(Array.isArray(a)){
  // English input answers can also accept their original Italian equivalents.
  if(key!=='answers')assert.equal(b.length,a.length,path);
  for(let i=0;i<a.length;i++)compare(a[i],b[i],path+'/'+i,key);
 }else if(a&&typeof a==='object'){
  for(const k of Object.keys(a)){
   if(k==='answers'&&a.mode==='choice'){assert.deepEqual(a[k],b[k],path);continue}
   compare(a[k],b[k],path+'/'+k,k);
  }
 }else if(typeof a==='string'&&readable.has(key)){
  assert.equal(typeof b,'string',path);if(a.trim())assert(b.trim(),path);
  assert.equal(arabic(b),arabic(a),'Arabic was altered at '+path);
  // English may spell out numbers differently, but source numeric references
  // and exercise labels must remain present in the same order.
  if(key!=='answers'){
   for(const pattern of [/[0-9]+(?:[–—:./,-][0-9]+)*%?/g,/(?<![\p{L}\p{N}_])[a-z]\)/gu]){
    let cursor=0;
    for(const token of a.match(pattern)||[]){
     const next=b.indexOf(token,cursor);
     assert(next>=0,'Missing reference '+token+' at '+path);
     cursor=next+token.length;
    }
   }
  }
 }else assert.deepEqual(b,a,path);
}
test('Every English document preserves Arabic, IDs, question modes, and course structure',()=>{
 for(const name of readdirSync('public/course').filter(n=>n.endsWith('.json'))){
  const it=read('public/course/'+name),en=read('public/course/en/'+name);
  assert.equal(en.contentLanguage,'en');compare(it,en,name);
 }
 compare(read('data/course.json'),read('data/course.en.json'),'index');
});
test('English opening lesson includes translated instruction and answers',()=>{
 const lesson=read('public/course/en/A0-L0-01.json');assert.equal(lesson.chapters[0].title,'Start with five letters');
 const first=lesson.exercises[0].items[0];assert.equal(first.prompt,'In which direction do you read an Arabic word?');assert(first.options.some(o=>o.text==='From right to left'));
});
test('Transliteration columns are kept verbatim, including unaccented Latin spellings',()=>{
 function walk(it,en){
  if(Array.isArray(it)){it.forEach((x,i)=>walk(x,en[i]));return}
  if(!it||typeof it!=='object')return;
  if(it.type==='table'&&it.rows?.length){
   it.rows[0].forEach((header,column)=>{if(header.toLowerCase().includes('traslitt'))it.rows.slice(1).forEach((row,i)=>{if(column<row.length)assert.equal(en.rows[i+1][column],row[column])})});
  }
  for(const key of Object.keys(it))if(key!=='answers')walk(it[key],en[key]);
 }
 for(const name of readdirSync('public/course').filter(n=>n.endsWith('.json')))walk(read('public/course/'+name),read('public/course/en/'+name));
});
