import {useEffect,useRef,useState} from 'react';
import ReferenceLibrary from './reference-library';
type Resource={id:string;title:string};
type Book={id:string;title:string;resources?:Resource[]};
type Lesson=Resource & {level:string;code:string};
export default function BookLibrary({books,lessons,data,put,onLesson,onResource}:{books:Book[];lessons:Lesson[];data:Record<string,any>;put:(k:string,v:any)=>void;onLesson:(id:string)=>void;onResource:(id:string)=>void}){
 const [volume,setVolume]=useState<string|null>(null),[query,setQuery]=useState('');
 const indexRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(volume)indexRef.current?.scrollIntoView({block:'start'});},[volume]);
 const book=books.find(b=>b.id===volume);
 const matches=(title:string)=>title.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'));
 const chapters=lessons.filter(l=>l.level===volume&&matches(l.title));
 const resources=(book?.resources||[]).filter(r=>matches(r.title)&&!lessons.some(l=>l.level===volume&&(r.title.startsWith(l.code+' ·')||r.title.startsWith(l.code+' '))));
 return <><div className="heading"><div><div className="eyebrow">LA TUA BIBLIOTECA</div><h1>I volumi di Arabic Academy.</h1><p>Scegli un volume e consulta il suo indice: lezioni, approfondimenti e soluzioni, tutti da leggere sul sito.</p></div></div>
 <div className="books volume-shelf">{books.map((b,i)=><button key={b.id} className="panel book-card" aria-pressed={volume===b.id} onClick={()=>{setVolume(b.id);setQuery('')}}><span className={'book-cover volume-cover volume-color-'+i}><span>ARABIC ACADEMY</span><strong>{b.id}</strong><span lang="ar" dir="rtl">العربية</span><small>{b.title}</small></span><h2>{b.title}</h2><p>{lessons.filter(l=>l.level===b.id).length} lezioni · materiale di consultazione</p><b>{volume===b.id?'Indice aperto ↓':'Sfoglia il volume →'}</b></button>)}</div>
 {book&&<section ref={indexRef} className="panel spaced volume-index" aria-label={'Indice del volume '+book.id}><div className="heading"><div><span className="eyebrow">VOLUME {book.id}</span><h2>{book.title}</h2></div><button className="secondary" onClick={()=>setVolume(null)}>Chiudi indice</button></div><label>Cerca nell’indice<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Titolo della lezione o argomento"/></label><h3>Lezioni</h3><div className="lesson-list">{chapters.map(l=><button className="volume-entry" key={l.id} onClick={()=>onLesson(l.id)}><span>{l.code}</span><b>{l.title}</b><span aria-hidden="true">→</span></button>)}</div><h3 className="spaced">Approfondimenti e soluzioni</h3><div className="lesson-list">{resources.map(r=><button className="volume-entry" key={r.id} onClick={()=>onResource(r.id)}><b>{r.title}</b><span aria-hidden="true">→</span></button>)}</div>{!chapters.length&&!resources.length&&<p>Nessun titolo trovato in questo volume. Prova un altro termine.</p>}</section>}
 <details className="panel spaced library-search"><summary>Cerca una parola nei testi e nel lessico</summary><ReferenceLibrary data={data} put={put} onLesson={onLesson}/></details>
 <p className="muted spaced">Sei volumi, dall’alfabeto al livello C1 «Competenza professionale».</p></>
}
