// 錦江町 森林管理システム：オフラインでも開けるようにするための仕組み
const VER='v21';
const SHELL='forest-shell-'+VER, DATA='forest-data-v1', TILES='forest-tiles-v1';
const SHELL_FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
const TILE_MAX=4000;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL).then(c=>Promise.all(SHELL_FILES.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('forest-shell-')&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function networkFirst(req,cacheName,fresh){
  const c=await caches.open(cacheName);
  // fresh: ブラウザの一時保存を使わず、毎回GitHubに最新版を確認する
  try{const r=await fetch(fresh?req.url:req,fresh?{cache:'no-cache',credentials:'same-origin'}:undefined);if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone()).catch(()=>{});return r}
  catch(e){const m=await c.match(req,{ignoreSearch:true});if(m)return m;throw e}
}
async function cacheFirst(req,cacheName,trim){
  const c=await caches.open(cacheName);
  const m=await c.match(req);if(m)return m;
  const r=await fetch(req);
  if(r&&(r.ok||r.type==='opaque')){c.put(req,r.clone()).then(()=>{if(trim)trimCache(c,trim)}).catch(()=>{})}
  return r;
}
// 地番データ：同じURL（版番号つき）なら保存分を使い、新しい版を取ったら古い版を消す
async function dataCache(req){
  const c=await caches.open(DATA);
  const m=await c.match(req);if(m)return m;
  const r=await fetch(req);
  if(r&&r.ok){
    await c.put(req,r.clone()).catch(()=>{});
    const path=new URL(req.url).pathname;
    for(const k of await c.keys()){const ku=new URL(k.url);if(ku.pathname===path&&k.url!==req.url)await c.delete(k)}
  }
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
  if(req.mode==='navigate'||(u.origin===location.origin&&(u.pathname.endsWith('/app/index.html')||u.pathname.endsWith('/app/')))){e.respondWith(networkFirst(req,SHELL,true));return}
  // 目録（小さい）は毎回最新を確認、地番データ本体は版番号が同じ間は端末の保存分を使う
  if(u.origin===location.origin&&u.pathname.endsWith('/app/data/index.json')){e.respondWith(networkFirst(req,DATA,true));return}
  if(u.origin===location.origin&&u.pathname.includes('/app/data/')){e.respondWith(dataCache(req));return}
  if(u.origin===location.origin&&u.pathname.endsWith('/app/kokuyu/index.json')){e.respondWith(networkFirst(req,DATA,true));return}
  if(u.origin===location.origin&&u.pathname.includes('/app/kokuyu/')){e.respondWith(dataCache(req));return}
  if(u.hostname==='cyberjapandata.gsi.go.jp'){e.respondWith(cacheFirst(req,TILES,TILE_MAX));return}
  if(u.hostname==='cdnjs.cloudflare.com'||u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(cacheFirst(req,SHELL));return}
  if(u.origin===location.origin){e.respondWith(networkFirst(req,SHELL))}
});
