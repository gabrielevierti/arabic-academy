// One database per Pages path, so different projects on the same origin stay separate.
const name = 'arabic-academy:' + import.meta.env.BASE_URL;
function open(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(name,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('records');
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error);
  r.onblocked=()=>reject(new Error('Chiudi le altre schede del corso e riprova.'));
 });
}
export async function readRecords():Promise<Record<string,any>> {
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('records','readonly'), store=tx.objectStore('records');
  const keys=store.getAllKeys(), values=store.getAll();
  tx.oncomplete=()=>{db.close();resolve(Object.fromEntries(keys.result.map((key,i)=>[String(key),values.result[i]])))};
  tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
export async function writeRecords(records:Record<string,any>):Promise<void> {
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('records','readwrite');
  for(const [key,value] of Object.entries(records))tx.objectStore('records').put(value,key);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
