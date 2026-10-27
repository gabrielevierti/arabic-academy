import React,{useSyncExternalStore} from 'react';
import en from '../locales/en.json';
export type Language='it'|'en';
const key='arabic-academy:language:'+import.meta.env.BASE_URL;
let language:Language='it';
try{if(localStorage.getItem(key)==='en')language='en'}catch{}
const listeners=new Set<()=>void>();
function updateDocument(){document.documentElement.lang=language;document.title=language==='it'?'Arabic Academy · Impara l’arabo':'Arabic Academy · Learn Arabic'}
updateDocument();
export function setLanguage(value:Language){language=value;try{localStorage.setItem(key,value)}catch{}updateDocument();listeners.forEach(fn=>fn())}
window.addEventListener('storage',event=>{if(event.key===key){language=event.newValue==='en'?'en':'it';updateDocument();listeners.forEach(fn=>fn())}});
export function useLanguage(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>language,()=> 'it' as Language)}
export function tr(text:string):string{
 if(language==='it')return text;
 const trimmed=text.trim();const translated=(en as Record<string,string>)[trimmed];
 if(translated)return text.replace(trimmed,translated);
 const prefix='La risposta non coincide con quella attesa: ';
 if(text.startsWith(prefix))return 'Your answer does not match the expected answer: '+text.slice(prefix.length);
 return text;
}
export function LanguagePicker(){
 const lang=useLanguage();
 return <div className="language-switch" role="group" aria-label={lang==='it'?'Lingua del corso':'Course language'}>
  <svg className="language-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>
  <button type="button" lang="it" aria-pressed={lang==='it'} onClick={()=>setLanguage('it')}><span className="language-code">IT</span><span className="language-name">Italiano</span></button>
  <button type="button" lang="en" aria-pressed={lang==='en'} onClick={()=>setLanguage('en')}><span className="language-code">EN</span><span className="language-name">English</span></button>
 </div>
}
export function CourseLanguageNotice(){const lang=useLanguage();return lang==='en'?<div className="translation-note" role="note" lang="en"><span aria-hidden="true">ⓘ</span><span>English edition · Machine-translated, with spot checks. Found an error? Please report the lesson and suggested correction on GitHub.</span></div>:null}
