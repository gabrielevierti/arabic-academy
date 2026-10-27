export function validRecord(key:string,v:any):boolean {
 const str=(s:any,max=50000)=>typeof s==='string'&&s.length<=max;
 const obj=()=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const date=(s:any)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
 const integer=(n:any,max=100000000)=>Number.isInteger(n)&&n>=0&&n<=max;
 if(key.startsWith('review:answer:native:'))return obj()&&date(v.due)&&integer(v.successes,10000)&&integer(v.interval,30)&&['good','again'].includes(v.lastRating)&&str(v.reviewedAt,40);
 if(key.startsWith('study:'))return date(key.slice(6))&&obj()&&integer(v.seconds,86400);
 if(key.startsWith('alphabet:'))return /^[ابتثجحخدذرزسشصضطظعغفقكلمنهوي]$/.test(key.slice(9))&&obj()&&(v.known===undefined||typeof v.known==='boolean')&&(v.lastCorrect===undefined||typeof v.lastCorrect==='boolean')&&(v.attempts===undefined||integer(v.attempts));
 if(key.startsWith('session:'))return obj()&&date(v.date)&&integer(v.seconds,86400)&&integer(v.answers,100)&&integer(v.good,100)&&v.good<=v.answers&&integer(v.read,100)&&['guided','review'].includes(v.kind);
 if(key==='last')return str(v,200);
 if(key==='goal')return [10,15,20,30,45,60].includes(v);
 if(key.startsWith('activity:'))return v===true;
 if(key.startsWith('note:'))return str(v);
 if(key.startsWith('progress:'))return obj()&&(v.done===undefined||typeof v.done==='boolean')&&(v.page===undefined||Number.isInteger(v.page)&&v.page>=1&&v.page<=10000);
 if(key.startsWith('answer:'))return obj()&&(v.text===undefined||str(v.text))&&(v.rating===undefined||['','good','again','partial','model'].includes(v.rating));
 if(key.startsWith('card:'))return v===null||obj()&&str(v.front,3000)&&str(v.back,3000)&&str(v.level,2)&&(!v.due||/^\d{4}-\d{2}-\d{2}$/.test(v.due));
 if(key.startsWith('quiz:'))return v===null||obj()&&str(v.question,3000)&&str(v.answer,3000)&&str(v.level,2);
 if(key.startsWith('lesson:'))return v===null||obj()&&str(v.id,200)&&str(v.title,200)&&str(v.content)&&v.custom===true&&['A0','A1','A2','B1','B2','C1','C2'].includes(v.level)&&Array.isArray(v.exercises)&&v.exercises.length===0&&Array.isArray(v.sections)&&v.sections.length===0;
 return false;
}
