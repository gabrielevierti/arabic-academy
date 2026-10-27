import {useEffect,useRef} from 'react';
import {localDay} from './learning';
export function useStudyTime(active:boolean,data:Record<string,any>,put:(key:string,value:any)=>void){
 const latest=useRef({data,put});latest.current={data,put};
 useEffect(()=>{if(!active)return;let last=Date.now(),interaction=last;
 const touch=()=>interaction=Date.now();const visibility=()=>{last=Date.now();if(document.visibilityState==='visible')interaction=last};
 window.addEventListener('pointerdown',touch);window.addEventListener('keydown',touch);window.addEventListener('scroll',touch,true);document.addEventListener('visibilitychange',visibility);
 const timer=setInterval(()=>{const now=Date.now(),delta=Math.min(5,Math.max(0,Math.floor((now-last)/1000)));last=now;if(document.visibilityState!=='visible'||now-interaction>60000||!delta)return;const {data,put}=latest.current;const today=localDay();put('study:'+today,{seconds:Math.min(86400,(data['study:'+today]?.seconds||0)+delta)});put('activity:'+today,true)},5000);
 return()=>{clearInterval(timer);window.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',touch);window.removeEventListener('scroll',touch,true);document.removeEventListener('visibilitychange',visibility)};
 },[active]);
}
