/* Service Worker خاص بطموح. لا يلمس أي Cache لتطبيقات أخرى (بادئة tmoh- فقط). */
const P="tmoh-",C=P+"v5",F=["./","index.html","app.js","style.css","icon.svg","manifest.json","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(F.map(u=>c.add(u).catch(()=>{})))));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(P)&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("message",e=>{if(e.data==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{const r=e.request,u=new URL(r.url);if(r.method!=="GET"||u.origin!==location.origin)return;
e.respondWith(fetch(r).then(res=>{if(res.ok&&res.type==="basic"){const c=res.clone();caches.open(C).then(x=>x.put(r,c))}return res})
.catch(()=>caches.match(r).then(m=>m||(r.mode==="navigate"?caches.match("index.html").then(i=>i||caches.match("./")):undefined)).then(m=>m||new Response("غير متصل بالإنترنت",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}}))))});
