export type Records=Record<string,any>;
export type Target={lessonId:string;groupId:string;questionId:string;key:string};
export const localDay=(date=new Date())=>date.toLocaleDateString('sv-SE');
export function parseAnswerKey(key:string):Target|null{const p=key.split(':');return p.length===5&&p[0]==='answer'&&p[1]==='native'?{lessonId:p[2],groupId:p[3],questionId:p[4],key}:null}
export function nextReview(previous:any,rating:string,date=new Date()){
 if(rating==='good'&&previous?.lastRating==='good'&&previous?.reviewedAt&&localDay(new Date(previous.reviewedAt))===localDay(date))return previous;
 const successes=rating==='good'?(previous?.successes||0)+1:0;
 const days=rating==='good'?[1,3,7,14,30][Math.min(successes-1,4)]:0;
 const due=new Date(date);due.setDate(due.getDate()+days);
 return {due:localDay(due),successes,interval:days,lastRating:rating,reviewedAt:date.toISOString()};
}
export function errorQueue(data:Records,today=localDay(),dueOnly=true):Target[]{
 return Object.entries(data).flatMap(([key,value])=>{
  const target=parseAnswerKey(key);if(!target)return [];
  const review=data['review:'+key];
  const pending=review?(!dueOnly||review.due<=today):['again','partial'].includes(value?.rating);
  return pending?[{...target,due:review?.due||'0000',checkedAt:value?.checkedAt||''}]:[];
 }).sort((a:any,b:any)=>a.due.localeCompare(b.due)||a.checkedAt.localeCompare(b.checkedAt));
}
export function streak(data:Records,date=new Date()){
 const d=new Date(date);if(!data['activity:'+localDay(d)])d.setDate(d.getDate()-1);
 let n=0;while(n<10000&&data['activity:'+localDay(d)]){n++;d.setDate(d.getDate()-1)}return n;
}
export function levelMetrics(lessons:any[],meta:Records,data:Records,level:string){
 const core=lessons.filter(l=>l.level===level&&meta[l.id]?.core);
 let low=0,high=0,read=0,answered=0,correct=0,chapters=0,questions=0;
 const answers=Object.entries(data).filter(([k])=>k.startsWith('answer:native:'));
 for(const l of core){const m=meta[l.id],p=data['progress:'+l.id]||{};
  const r=new Set((p.read||[]).filter((i:any)=>Number.isInteger(i)&&i>=0&&i<m.chapters)).size;
  const a=answers.filter(([k,v])=>k.startsWith('answer:native:'+l.id+':')&&['good','again','partial'].includes(v?.rating));
  const good=a.filter(([,v])=>v.rating==='good').length;
  read+=r;answered+=a.length;correct+=good;chapters+=m.chapters;questions+=m.questions;
  const fraction=p.done?1:Math.min(1,.5*r/Math.max(1,m.chapters)+.5*good/Math.max(1,m.questions));
  low+=(m.hours?.[0]||0)*(1-fraction);high+=(m.hours?.[1]||0)*(1-fraction);
 }
 return {total:core.length,done:core.filter(l=>data['progress:'+l.id]?.done).length,read,answered,correct,chapters,questions,low:Math.ceil(low),high:Math.ceil(high)};
}
