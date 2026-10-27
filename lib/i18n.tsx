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
export function LanguagePicker(){const lang=useLanguage();return <label className="language-picker"><span>{lang==='it'?'Lingua':'Language'}</span><select aria-label={lang==='it'?'Lingua dell’interfaccia':'Interface language'} value={lang} onChange={e=>setLanguage(e.target.value as Language)}><option value="it">Italiano</option><option value="en">English</option></select></label>}
export function CourseLanguageNotice(){const lang=useLanguage();return lang==='en'?<div className="info-banner" role="note" lang="en">Interface language: English. The course texts, activity instructions and model answers are currently in Italian and Arabic. Your notes and progress are unchanged.</div>:null}
