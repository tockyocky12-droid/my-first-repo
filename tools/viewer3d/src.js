// 3D表示（試作）：地理院の標高タイルで地形を作り、航空写真と地番の線を貼り付けて立体で見る
// ビルド：tools/viewer3d/build.sh（three.js r187 を bun でまとめて app/lib/viewer3d/viewer3d.js を作る）
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

const GSI='https://cyberjapandata.gsi.go.jp/xyz/';
const DEM_Z=15, PHOTO_Z=17, N=2;            // 標高はz15の2×2枚（約2km四方）、写真はz17（1枚約0.9m/画素）
const EARTH=40075016.686;
const $=id=>document.getElementById(id);
const msg=t=>{const m=$('msg');m.textContent=t;m.hidden=!t};
let bytes=0;

const lon2x=(lon,z)=>(lon+180)/360*2**z;
const lat2y=(lat,z)=>{const r=lat*Math.PI/180;return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z};

async function getImg(url){
  const r=await fetch(url,{mode:'cors'});if(!r.ok)throw new Error(r.status);
  const b=await r.blob();bytes+=b.size;return await createImageBitmap(b);
}
// 標高PNG（地理院の形式）を数値にする：x<2^23ならx*0.01m、x>2^23なら(x-2^24)*0.01m、2^23は値なし
function decodeDem(bmp,sx=0,sy=0,sw=256,sh=256){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(bmp,sx,sy,sw,sh,0,0,256,256);
  const d=g.getImageData(0,0,256,256).data,h=new Float32Array(256*256);
  for(let i=0;i<h.length;i++){const x=d[i*4]*65536+d[i*4+1]*256+d[i*4+2];h[i]=x===8388608?NaN:(x<8388608?x:x-16777216)*0.01}
  return h;
}
async function demTile(x,y){
  for(const k of ['dem5a_png','dem5b_png','dem5c_png']){try{return decodeDem(await getImg(`${GSI}${k}/${DEM_Z}/${x}/${y}.png`))}catch(_){}}
  // 5mメッシュがない所は10mメッシュ（z14）の4分の1を引き伸ばして使う
  const bmp=await getImg(`${GSI}dem_png/${DEM_Z-1}/${x>>1}/${y>>1}.png`);
  return decodeDem(bmp,(x&1)*128,(y&1)*128,128,128);
}

async function build(data){
  const {items,center}=data;
  const fx=lon2x(center[1],DEM_Z),fy=lat2y(center[0],DEM_Z);
  const tx0=Math.round(fx)-1,ty0=Math.round(fy)-1;                     // 中心が真ん中寄りになる2×2枚
  const tileM=EARTH*Math.cos(center[0]*Math.PI/180)/2**DEM_Z;          // 1枚の一辺（m）
  const size=tileM*N, G=256*N;                                         // 全体の一辺（m）と標高の格子数

  msg('地形を読み込んでいます…');
  const hs=new Float32Array(G*G);
  await Promise.all([0,1].flatMap(j=>[0,1].map(async i=>{
    let h;try{h=await demTile(tx0+i,ty0+j)}catch(_){h=new Float32Array(65536).fill(NaN)}
    for(let y=0;y<256;y++)for(let x=0;x<256;x++)hs[(j*256+y)*G+i*256+x]=h[y*256+x];
  })));
  let mn=Infinity,valid=0;for(const v of hs)if(!isNaN(v)){valid++;if(v<mn)mn=v}
  if(!valid)throw new Error('dem');
  for(let i=0;i<hs.length;i++)if(isNaN(hs[i])||hs[i]<mn)hs[i]=mn;       // 海などの値なしは一番低い所にそろえる

  msg('航空写真を読み込んでいます…');
  const k=2**(PHOTO_Z-DEM_Z),T=256*k*N;                                // 写真の画素数（一辺）
  const cv=document.createElement('canvas');cv.width=cv.height=Math.min(T,4096);
  const sc=cv.width/T,ctx=cv.getContext('2d');ctx.fillStyle='#9aa89a';ctx.fillRect(0,0,cv.width,cv.height);
  const px0=tx0*k,py0=ty0*k;let got=0;
  await Promise.all(Array.from({length:(k*N)**2},(_,n)=>n).map(async n=>{
    const i=n%(k*N),j=Math.floor(n/(k*N));
    try{const b=await getImg(`${GSI}seamlessphoto/${PHOTO_Z}/${px0+i}/${py0+j}.jpg`);ctx.drawImage(b,i*256*sc,j*256*sc,256*sc,256*sc);got++}catch(_){}
  }));
  if(!got)msg('航空写真を読み込めませんでした（地形と地番の線だけ表示します）');

  // 地番の線と番号を写真に書き込む
  const P=(lon,lat)=>[(lon2x(lon,PHOTO_Z)-px0)*256*sc,(lat2y(lat,PHOTO_Z)-py0)*256*sc];
  const path=rings=>{ctx.beginPath();for(const r of rings){r.forEach(([lo,la],q)=>{const [x,y]=P(lo,la);q?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}};
  ctx.lineJoin='round';
  // 国有林の小班は薄い緑で塗って水色の線（地番は白い線）
  for(const it of items){if(it.s||!it.k)continue;path(it.r);ctx.fillStyle='rgba(60,170,120,.18)';ctx.fill('evenodd');ctx.strokeStyle='rgba(125,211,252,.95)';ctx.lineWidth=Math.max(1.5,2.2*sc);ctx.stroke()}
  for(const it of items){if(it.s||it.k)continue;path(it.r);ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=Math.max(1.2,1.6*sc);ctx.stroke()}
  const sel=items.find(it=>it.s);
  if(sel){path(sel.r);ctx.fillStyle='rgba(220,30,40,.45)';ctx.fill('evenodd');ctx.strokeStyle='#ff2a2a';ctx.lineWidth=Math.max(2,4*sc);ctx.stroke()}
  // 番号は写真に書き込まず、いつも正面を向く札（スプライト）にする。ここでは置き場所だけ集める
  const labels=[];const mpp=size/cv.width;                           // 写真1画素あたりのm
  const mctx=document.createElement('canvas').getContext('2d');mctx.font='700 48px sans-serif';
  for(const it of items){
    const pts=it.r[0].map(([lo,la])=>P(lo,la));if(!pts.length||!it.n)continue;
    let a=0,cx=0,cy=0;for(let q=0;q<pts.length;q++){const [x1,y1]=pts[q],[x2,y2]=pts[(q+1)%pts.length],f=x1*y2-x2*y1;a+=f;cx+=(x1+x2)*f;cy+=(y1+y2)*f}
    a/=2;const m2=Math.abs(a)*mpp*mpp;if(!it.s&&m2<2500)continue;   // 小さい筆（約2,500m²未満）は番号を省く
    cx/=6*a;cy/=6*a;let bx0=1e9,bx1=-1e9;for(const [x] of pts){bx0=Math.min(bx0,x);bx1=Math.max(bx1,x)}
    const wm=13*mctx.measureText(it.n).width/56;                      // 札の幅（m）
    if(!it.s&&wm>(bx1-bx0)*mpp*0.9)continue;                         // 筆からはみ出す番号は省く
    labels.push({n:it.n,s:!!it.s,k:!!it.k,x:cx/cv.width*size-size/2,z:cy/cv.height*size-size/2,a:m2});
  }
  labels.sort((p,q)=>(q.s-p.s)||(q.a-p.a));labels.length=Math.min(labels.length,700);

  // 地形の形を作る（格子を半分に間引いて軽くする）
  const S=G/2,geo=new THREE.PlaneGeometry(size,size,S,S);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position;
  for(let j=0;j<=S;j++)for(let i=0;i<=S;i++){
    const gx=Math.min(G-1,i*2),gy=Math.min(G-1,j*2);pos.setY(j*(S+1)+i,hs[gy*G+gx]-mn)}
  geo.computeVertexNormals();
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:tex}));
  // 選んだ地番の位置（地形の上）
  const wx=(fx-tx0)/N*size-size/2,wz=(fy-ty0)/N*size-size/2;
  const gi=Math.max(0,Math.min(G-1,Math.round((fx-tx0)*256))),gj=Math.max(0,Math.min(G-1,Math.round((fy-ty0)*256)));
  const hAt=(x,z)=>{const gx=Math.max(0,Math.min(G-1,Math.round((x+size/2)/size*G))),gy=Math.max(0,Math.min(G-1,Math.round((z+size/2)/size*G)));return hs[gy*G+gx]-mn};
  return {mesh,size,target:new THREE.Vector3(wx,hs[gj*G+gi]-mn,wz),span:data.span||300,labels:makeLabels(labels,hAt)};
}

// 番号の札：全部の番号を1枚の画像にまとめ、札ごとにその一部を使う（画像の読み込みは1回だけ）
function makeLabels(list,hAt){
  const g=new THREE.Group();if(!list.length)return g;
  const FS=48,PAD=8,AW=2048,c=document.createElement('canvas'),x=c.getContext('2d');
  x.font=`700 ${FS}px sans-serif`;
  const boxes=[];let cx=0,cy=0;const H=FS+PAD*2;
  for(const l of list){const w=Math.ceil(x.measureText(l.n).width)+PAD*2;if(cx+w>AW){cx=0;cy+=H}if(cy+H>4096)break;boxes.push({l,x:cx,y:cy,w});cx+=w}
  c.width=AW;c.height=Math.max(64,2**Math.ceil(Math.log2(cy+H)));
  x.font=`700 ${FS}px sans-serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
  for(const b of boxes){const tx=b.x+b.w/2,ty=b.y+H/2;x.lineWidth=FS/4.5;x.strokeStyle='rgba(0,0,0,.75)';x.strokeText(b.l.n,tx,ty);x.fillStyle=b.l.s?'#fff':b.l.k?'#bef264':'#7fe9ff';x.fillText(b.l.n,tx,ty)}
  const base=new THREE.CanvasTexture(c);base.colorSpace=THREE.SRGBColorSpace;base.generateMipmaps=true;base.minFilter=THREE.LinearMipmapLinearFilter;
  for(const b of boxes){
    const t=base.clone();t.repeat.set(b.w/c.width,H/c.height);t.offset.set(b.x/c.width,1-(b.y+H)/c.height);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:!b.l.s,depthWrite:false})); // 選んだ地番の番号は山に隠れないようにする
    const hm=b.l.s?24:13;sp.scale.set(hm*b.w/H,hm,1);sp.center.set(0.5,0);
    sp.userData.h=hAt(b.l.x,b.l.z);sp.position.set(b.l.x,sp.userData.h+5,b.l.z);if(b.l.s)sp.renderOrder=2;g.add(sp);
  }
  return g;
}

function start(data){
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);$('view').append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xcfe3ef);scene.fog=new THREE.Fog(0xcfe3ef,1500,4200);
  scene.add(new THREE.HemisphereLight(0xffffff,0x667766,1.6));const sun=new THREE.DirectionalLight(0xffffff,1.4);sun.position.set(-600,900,400);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,1,20000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*0.47;controls.minDistance=60;controls.maxDistance=3000;
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
  let mesh=null,tb=null;
  // 高さの強調：地形の高さを何倍にするか（見ている向きと距離はそのまま）
  let labels=null;
  const setEx=v=>{if(mesh)mesh.scale.y=v;if(labels)labels.children.forEach(sp=>sp.position.y=sp.userData.h*v+5);document.querySelectorAll('#ex button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.v===v)));
    if(tb){const off=camera.position.clone().sub(controls.target);controls.target.set(tb.x,tb.y*v,tb.z);camera.position.copy(controls.target).add(off);controls.update()}};
  document.querySelectorAll('#ex button').forEach(b=>b.onclick=()=>setEx(+b.dataset.v));
  (function loop(){requestAnimationFrame(loop);controls.update();
    // 遠くの番号は小さく読めず、画面が混み合うので隠す
    if(labels){const far=Math.max(900,camera.position.distanceTo(controls.target)*1.6);for(const sp of labels.children)sp.visible=sp.renderOrder===2||sp.position.distanceTo(camera.position)<far}
    renderer.render(scene,camera)})();
  build(data).then(r=>{
    mesh=r.mesh;scene.add(mesh);labels=r.labels;scene.add(labels);tb=r.target.clone();
    const t=tb.clone();t.y*=1.5;controls.target.copy(t);mesh.scale.y=1.5;
    const d=Math.max(550,Math.min(1800,r.span*4));camera.position.set(t.x-d*0.25,t.y+d*0.62,t.z+d*0.85);controls.update();
    setEx(1);msg('');$('info').textContent=`データ 約${(bytes/1048576).toFixed(1)}MB（同じ場所の2回目からは端末の保存分）・ 約${(r.size/1000).toFixed(1)}km四方`;
  }).catch(e=>{console.error(e);msg('地形データを読み込めませんでした。通信状態を確かめて、もう一度開いてください')});
}

// 親の画面（森林ナビ）から地番の形を受け取って始める
let begun=false;
addEventListener('message',e=>{if(e.origin!==location.origin||begun||!e.data||e.data.type!=='v3d')return;begun=true;$('ttl').textContent=e.data.title||'';start(e.data)});
if(parent!==window)parent.postMessage({type:'v3d-ready'},location.origin);
