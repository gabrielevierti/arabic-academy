import {useRef,useState} from 'react';
export default function Navigation({view,navigate,mobile=false}:{view:string;navigate:(v:string)=>void;mobile?:boolean}){
 const [more,setMore]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const items=[['course','Corso'],['stats','Progressi'],['library','Biblioteca']];
 const shortcuts=[['practice','Esercizi'],['review','Ripasso errori'],['flashcards','Flashcard'],['alphabet','Alfabeto']];
 const render=(list:string[][])=>list.map(([id,label])=>{const active=id==='course'?['home','course','lesson','session','error-session'].includes(view):view===id;return <button key={id} className={(mobile?'':'nav ')+(active?'active':'')} aria-current={active?'page':undefined} onClick={()=>{navigate(id);setMore(false)}}>{label}</button>});
 return <nav className={mobile?'mobile-nav':''} aria-label="Navigazione principale">{render(items)}{!mobile&&<div className="nav-shortcuts"><span className="eyebrow">STRUMENTI DI STUDIO</span>{render(shortcuts)}</div>}{mobile&&<><button ref={trigger} aria-expanded={more} aria-controls="mobile-overflow" onClick={()=>setMore(!more)}>Altro {more?'−':'+'}</button>{more&&<div id="mobile-overflow" onKeyDown={e=>{if(e.key==='Escape'){setMore(false);trigger.current?.focus()}}}>{render([...shortcuts,['settings','Impostazioni']])}</div>}</>}</nav>
}
