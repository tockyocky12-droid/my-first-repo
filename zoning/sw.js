// 錦江町森林ゾーニング：オフラインでも開けるようにするための仕組み（地番・国有林のデータは森林管理システムのものを使う）
const VER='z12';
// この仕組みが置かれたフォルダ（例：/my-first-repo/app/）。町ごとのフォルダで同じファイルを使う
const BASE=new URL(self.registration.scope).pathname;
const PFX='zoning';
const DBASE=BASE.replace(/zoning\/$/,'app/'); // データは森林管理システムのフォルダにある
const SHELL=PFX+'-shell-'+VER, DATA=PFX+'-data-v1', TILES=PFX+'-tiles-v1';
const SHELL_FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  '../app/lib/leaflet-1.9.4/leaflet.css','../app/lib/leaflet-1.9.4/leaflet.js']; // 地図の部品は森林管理システムと同じものを使う（外部のサーバーに頼らない）
const TILE_MAX=6000;            // 一度見た地図の画像を覚えておく枚数
const SAVED='gsi-saved-v1';      // 「地図を端末に保存」で保存した画像（自動では消さない。どのアプリからも使う）

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL).then(c=>Promise.all(SHELL_FILES.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PFX+'-shell-')&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()).then(()=>purgeOpaque()));
});
// 以前の版で保存した「中身の見えない形」の地図画像を消す（Chromeは1件を約7MBとして数えるため）
async function purgeOpaque(){
  for(const name of [TILES]){try{const c=await caches.open(name);
    for(const k of await c.keys()){const r=await c.match(k);if(r&&r.type==='opaque')await c.delete(k)}}catch(_){}}
}

async function networkFirst(req,cacheName,fresh){
  const c=await caches.open(cacheName);
  // fresh: ブラウザの一時保存を使わず、毎回GitHubに最新版を確認する
  try{const r=await fetch(fresh?req.url:req,fresh?{cache:'no-cache',credentials:'same-origin'}:undefined);if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone()).catch(()=>{});return r}
  catch(e){const m=await c.match(req,{ignoreSearch:true});if(m)return m;throw e}
}
async function cacheFirst(req,cacheName,trim){
  const c=await caches.open(cacheName);
  let m=(await c.match(req))||(await (await caches.open(SAVED)).match(req.url));
  if(m&&m.type==='opaque'&&req.mode==='cors'){c.delete(req).catch(()=>{});m=null} // 古い形で保存した画像は使わずに取り直す
  if(m)return m;
  const r=await fetch(req);
  // 地図の画像は中身の見えない形（opaque）では保存しない（文字の形のファイルは従来どおり）
  if(r&&(r.ok||(r.type==='opaque'&&cacheName!==TILES))){c.put(req,r.clone()).then(()=>{if(trim)trimCache(c,trim)}).catch(()=>{})}
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
  if(req.mode==='navigate'||(u.origin===location.origin&&(u.pathname===BASE+'index.html'||u.pathname===BASE))){e.respondWith(networkFirst(req,SHELL,true));return}
  // 目録（小さい）は毎回最新を確認、地番データ本体は版番号が同じ間は端末の保存分を使う
  if(u.origin===location.origin&&u.pathname===DBASE+'data/index.json'){e.respondWith(networkFirst(req,DATA,true));return}
  if(u.origin===location.origin&&u.pathname.startsWith(DBASE+'data/')){e.respondWith(dataCache(req));return}
  if(u.origin===location.origin&&u.pathname===DBASE+'kokuyu/index.json'){e.respondWith(networkFirst(req,DATA,true));return}
  if(u.origin===location.origin&&u.pathname.startsWith(DBASE+'kokuyu/')){e.respondWith(dataCache(req));return}
  // 地図の画像は保存分を先に使う（画面から直接読むもの＝保存処理や標高の計算は、そのまま通す）
  if(u.hostname==='cyberjapandata.gsi.go.jp'){if(req.destination==='image'||/^\/xyz\/(dem|seamlessphoto)/.test(u.pathname))e.respondWith(cacheFirst(req,TILES,TILE_MAX));return}
  if(u.origin===location.origin&&u.pathname.startsWith(DBASE+'lib/')){e.respondWith(cacheFirst(req,SHELL));return} // 地図の部品・3D表示の部品（版番号つき）
  if(u.origin===location.origin&&u.pathname===DBASE+'3d.html'){e.respondWith(networkFirst(req,SHELL,true));return}
  if(u.hostname==='cdnjs.cloudflare.com'||u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(cacheFirst(req,SHELL));return}
  if(u.origin===location.origin&&u.pathname.startsWith(BASE)){e.respondWith(networkFirst(req,SHELL))}
});
