import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const files = {};
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (!p.endsWith("sw.js"))
      files[p.slice(5)] = crypto
        .createHash("sha256")
        .update(fs.readFileSync(p))
        .digest("hex");
  }
}
walk("dist");
const version = crypto
  .createHash("sha256")
  .update(JSON.stringify(files))
  .digest("hex")
  .slice(0, 16);
const shell = [
  "index.html",
  "favicon.svg",
  "manifest.webmanifest",
  ...Object.keys(files).filter(
    (x) => x.startsWith("assets/") && /index-.*\.(js|css)$/.test(x),
  ),
];
fs.writeFileSync(
  "dist/sw.js",
  `const VERSION=${JSON.stringify(version)}, HASHES=${JSON.stringify(files)}, SHELL=${JSON.stringify(shell)};
const PREFIX='arabic-academy:'+self.registration.scope, CACHE=PREFIX+VERSION;
const url=p=>new URL(p,self.registration.scope).href;
async function verified(request,key){const response=await fetch(request,{cache:'no-cache'});if(!response.ok)throw Error('Network failure');if(HASHES[key]){const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');if(hex!==HASHES[key])throw Error('New content release: reload after update');}return response;}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(SHELL.map(async key=>cache.put(url(key),await verified(url(key),key))))})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();if(event.data?.type==='CACHE_VISITED')event.waitUntil((async()=>{const c=await caches.open(CACHE);for(const href of event.data.urls||[]){const u=new URL(href),scope=new URL(self.registration.scope);if(u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))continue;const key=decodeURIComponent(u.pathname.slice(scope.pathname.length));if(HASHES[key])try{await c.put(url(key),await verified(url(key),key))}catch{}}})())});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url),scope=new URL(self.registration.scope);if(u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;let key=decodeURIComponent(u.pathname.slice(scope.pathname.length));if(event.request.mode==='navigate')key='index.html';if(!HASHES[key])return;
event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(url(key));if(cached)return cached;try{const response=await verified(url(key),key);await cache.put(url(key),response.clone());return response}catch{return new Response('Content unavailable offline or changed in a newer release. Reconnect and update Arabo da Zero.',{status:503,headers:{'Content-Type':'text/plain'}})}})())});
`,
);
console.log(
  "Offline release",
  version,
  "manifest entries",
  Object.keys(files).length,
);
