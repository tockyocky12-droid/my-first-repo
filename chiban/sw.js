// 錦江町 地番メモ：オフラインでも開けるようにするための仕組み
const VER='v1';
const SHELL='shell-'+VER, DATA='data-v1', TILES='tiles-v1';
const SHELL_FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
const TILE_MAX=4000;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL).then(c=>Promise.all(SHELL_FILES.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('shell-')&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function networkFirst(req,cacheName){
  const c=await caches.open(cacheName);
  try{const r=await fetch(req);if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone()).catch(()=>{});return r}
  catch(e){const m=await c.match(req,{ignoreSearch:true});if(m)return m;throw e}
}
async function cacheFirst(req,cacheName,trim){
  const c=await caches.open(cacheName);
  const m=await c.match(req);if(m)return m;
  const r=await fetch(req);
  if(r&&(r.ok||r.type==='opaque')){c.put(req,r.clone()).then(()=>{if(trim)trimCache(c,trim)}).catch(()=>{})}
  return r;
}
let trimming=false;
async function trimCache(c,max){
  if(trimming)return;trimming=true;
  try{const keys=await c.keys();if(keys.length>max){for(const k of keys.slice(0,keys.length-max))await c.delete(k)}}finally{trimming=false}
}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(req.mode==='navigate'||(u.origin===location.origin&&u.pathname.endsWith('/chiban/index.html'))){e.respondWith(networkFirst(req,SHELL));return}
  if(u.origin===location.origin&&u.pathname.endsWith('/data/index.json')){e.respondWith(networkFirst(req,DATA));return}
  if(u.origin===location.origin&&u.pathname.includes('/app/data/')){e.respondWith(cacheFirst(req,DATA));return}
  if(u.hostname==='cyberjapandata.gsi.go.jp'){e.respondWith(cacheFirst(req,TILES,TILE_MAX));return}
  if(u.hostname==='cdnjs.cloudflare.com'||u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(cacheFirst(req,SHELL));return}
  if(u.origin===location.origin){e.respondWith(networkFirst(req,SHELL))}
});
