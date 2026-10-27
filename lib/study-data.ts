export function validRecord(key:string,v:any):boolean {
 const str=(s:any,max=50000)=>typeof s==='string'&&s.length<=max;
 const obj=()=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(key==='last')return str(v,200);
 if(key==='goal')return [10,20,30,45,60].includes(v);
 if(key.startsWith('activity:'))return v===true;
 if(key.startsWith('note:'))return str(v);
 if(key.startsWith('progress:'))return obj()&&(v.done===undefined||typeof v.done==='boolean')&&(v.page===undefined||Number.isInteger(v.page)&&v.page>=1&&v.page<=10000);
 if(key.startsWith('answer:'))return obj()&&(v.text===undefined||str(v.text))&&(v.rating===undefined||['','good','again','partial','model'].includes(v.rating));
 if(key.startsWith('card:'))return v===null||obj()&&str(v.front,3000)&&str(v.back,3000)&&str(v.level,2)&&(!v.due||/^\d{4}-\d{2}-\d{2}$/.test(v.due));
 if(key.startsWith('quiz:'))return v===null||obj()&&str(v.question,3000)&&str(v.answer,3000)&&str(v.level,2);
 if(key.startsWith('lesson:'))return v===null||obj()&&str(v.id,200)&&str(v.title,200)&&str(v.content)&&v.custom===true&&['A0','A1','A2','B1','B2','C1','C2'].includes(v.level)&&Array.isArray(v.exercises)&&v.exercises.length===0&&Array.isArray(v.sections)&&v.sections.length===0;
 return false;
}
