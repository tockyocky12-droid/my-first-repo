"""地番データ（登記所備付地図データ）のない区域を、約200m四方のます目で求める。
市町村の境界（国土数値情報 行政区域 N03）の内側で、地番の筆も国有林も無います目を「地番データなし」とする。
使い方: python3 build_nodata.py <市町村境界geojsonのフォルダ> <地番データのフォルダ(data)> <国有林のフォルダ(kokuyu)> <出力json> <市町村コード...>
出力: {"cell":[dlng,dlat],"m":{市町村コード:{"o":[lng0,lat0],"r":[[行,列の始め,列の終わり],...]}}}（行ごとに続くます目をまとめる）
"""
import json,sys,os,glob,math
from PIL import Image,ImageDraw
bdir,ddir,kdir,out=sys.argv[1:5];codes=sys.argv[5:]
PX=20.0      # 下絵の1画素（m）
CELL=10      # ます目＝10画素（200m）
def rings(g):
    if g['type']=='Polygon':return g['coordinates']
    if g['type']=='MultiPolygon':return [r for p in g['coordinates'] for r in p]
    return []
def polys(g):
    if g['type']=='Polygon':return [g['coordinates']]
    if g['type']=='MultiPolygon':return g['coordinates']
    return []
def feats(paths):
    for p in paths:
        try:d=json.load(open(p,encoding='utf-8'))
        except Exception:continue
        for f in d.get('features',[]):
            if f.get('geometry'):yield f
kk=list(feats(glob.glob(os.path.join(kdir,'u*.geojson'))))
res={}
for mc in codes:
    bd=json.load(open(os.path.join(bdir,mc+'.json'),encoding='utf-8'))
    bps=[p for f in bd['features'] for p in polys(f['geometry'])]
    xs=[c[0] for p in bps for r in p for c in r];ys=[c[1] for p in bps for r in p for c in r]
    x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
    lat=(y0+y1)/2;mx=111320*math.cos(math.radians(lat));my=110950
    dx=PX/mx;dy=PX/my
    W=int((x1-x0)/dx)+CELL;H=int((y1-y0)/dy)+CELL
    W+= -W%CELL;H+= -H%CELL
    T=lambda c:((c[0]-x0)/dx,(y1-c[1])/dy)
    def draw(img,plist,fill):
        d=ImageDraw.Draw(img)
        for p in plist:
            if len(p[0])>2:d.polygon([T(c) for c in p[0]],fill=fill)
            for h in p[1:]:
                if len(h)>2:d.polygon([T(c) for c in h],fill=0)
    # このデータは島などの部分が「穴」として入っていることがあるので、輪はすべて塗る
    inside=Image.new('L',(W,H),0);di=ImageDraw.Draw(inside)
    for p in bps:
        for r in p:
            if len(r)>2:di.polygon([T(c) for c in r],fill=255)
    cov=Image.new('L',(W,H),0);dc=ImageDraw.Draw(cov)
    files=glob.glob(os.path.join(ddir,mc,'*.geojson')) if os.path.isdir(os.path.join(ddir,mc)) else glob.glob(os.path.join(ddir,'*.geojson'))
    n=0
    for f in feats(files):
        for p in polys(f['geometry']):
            if len(p[0])>2:dc.polygon([T(c) for c in p[0]],fill=255,outline=255);n+=1
    for f in kk:
        for p in polys(f['geometry']):
            if len(p[0])>2:dc.polygon([T(c) for c in p[0]],fill=255,outline=255)
    # ます目ごとの割合
    gw,gh=W//CELL,H//CELL
    ins=inside.resize((gw,gh),Image.BOX).load();cv=cov.resize((gw,gh),Image.BOX).load()
    grid=[[ins[i,j]>=128 and cv[i,j]<=13 for i in range(gw)] for j in range(gh)]  # 町の内側が半分以上、筆・国有林が5%以下
    # 小さなかたまり（3ます以下：川・道路・ため池など）は除く
    seen=[[False]*gw for _ in range(gh)]
    for j in range(gh):
        for i in range(gw):
            if grid[j][i] and not seen[j][i]:
                st=[(j,i)];comp=[];seen[j][i]=True
                while st:
                    a,b=st.pop();comp.append((a,b))
                    for aa,bb in ((a+1,b),(a-1,b),(a,b+1),(a,b-1)):
                        if 0<=aa<gh and 0<=bb<gw and grid[aa][bb] and not seen[aa][bb]:seen[aa][bb]=True;st.append((aa,bb))
                if len(comp)<=3:
                    for a,b in comp:grid[a][b]=False
    runs=[];cnt=0
    for j in range(gh):
        i=0
        while i<gw:
            if grid[j][i]:
                k=i
                while k+1<gw and grid[j][k+1]:k+=1
                runs.append([j,i,k]);cnt+=k-i+1;i=k+1
            else:i+=1
    res[mc]={'o':[round(x0,6),round(y1,6)],'c':[round(dx*CELL,8),round(dy*CELL,8)],'r':runs}
    if os.environ.get('DBG'):
        dbg=Image.merge('RGB',(inside.point(lambda v:v//3),cov,Image.new('L',(W,H),0)));dd=ImageDraw.Draw(dbg)
        for j,a,b in runs:dd.rectangle([a*CELL,j*CELL,(b+1)*CELL-1,(j+1)*CELL-1],outline=(255,0,255))
        dbg.thumbnail((900,900));dbg.save(f'/home/claude/work/dbg_{mc}.png')
    print(mc,'parcels',n,'nodata cells',cnt,f'≈{cnt*0.04:.1f}km2')
json.dump({'m':res,'src':'国土数値情報（行政区域データ）（国土交通省）を加工'},open(out,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('bytes',os.path.getsize(out))
