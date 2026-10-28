import type {ReactNode} from 'react';
import {useEffect,useState} from 'react';
type Course=typeof import('../data/course.json');
export default function CourseIndex({children}:{children:(course:Course)=>ReactNode}){
 const [course,setCourse]=useState<Course|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;import('../data/course.json').then(m=>live&&setCourse(m.default)).catch(()=>live&&setFailed(true));return()=>{live=false}},[]);
 if(!course)return <main className="panel" role="status">{failed?'Il corso non è disponibile. Ricarica la pagina per riprovare.':'Caricamento del corso…'}</main>;
 return children(course);
}
