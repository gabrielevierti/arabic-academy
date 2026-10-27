import type {Language} from './i18n';
const cache=new Map<string,Promise<any>>();
export function loadCourse(id:string,language:Language):Promise<any>{
 const key=language+':'+id;
 const existing=cache.get(key);if(existing)return existing;
 const url=import.meta.env.BASE_URL+'course/'+(language==='en'?'en/':'')+encodeURIComponent(id)+'.json';
 const request=fetch(url).then(response=>{if(!response.ok)throw new Error('Course content unavailable');return response.json()}).catch(error=>{cache.delete(key);throw error});
 cache.set(key,request);return request;
}
