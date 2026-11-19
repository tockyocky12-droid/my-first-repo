# 錦江町版（app/）のアプリ本体を、ほかの町のフォルダへ写す。
# 町ごとに違うのは config.js・manifest.webmanifest・data/・kokuyu/ と、index.html のタイトル2か所だけ。
import shutil, re, sys, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 南大隅町版・肝付町版は2026-11-17に大隅版へ統合して削除（フォルダには移転の案内だけ残す）
TOWNS={'../kagoshima-forest':{'title':'かごしま森林ナビ 大隅','short':'森林ナビ 大隅','3d':True}}
for d,t in TOWNS.items():
    h=open(os.path.join(ROOT,'app','index.html'),encoding='utf-8').read()
    h=h.replace('<title>きんこう森林ナビ</title>',f"<title>{t['title']}</title>",1)
    h=h.replace('<h1>きんこう森林ナビ</h1>',f"<h1>{t.get('h1',t['title'])}</h1>",1)
    h=h.replace('<meta name="apple-mobile-web-app-title" content="きんこう森林ナビ">',f"<meta name=\"apple-mobile-web-app-title\" content=\"{t['short']}\">",1)
    dst=os.path.normpath(os.path.join(ROOT,d))
    if not os.path.isdir(dst):print('skip',d,'(フォルダがありません)');continue  # かごしま版は別のリポジトリ（kagoshima-forest）
    open(os.path.join(dst,'index.html'),'w',encoding='utf-8').write(h)
    shutil.copy(os.path.join(ROOT,'app','sw.js'),os.path.join(dst,'sw.js'))
    td=t.get('3d',False)  # 3D表示（three.js と 3d.html）を写す町。ボタンを出すかは各町の config.js の view3d で決める
    shutil.copytree(os.path.join(ROOT,'app','lib'),os.path.join(dst,'lib'),dirs_exist_ok=True,ignore=None if td else shutil.ignore_patterns('viewer3d'))  # 地図の部品（Leaflet など）
    if td:shutil.copy(os.path.join(ROOT,'app','3d.html'),os.path.join(dst,'3d.html'))
    print('updated',d)
# ゾーニングの3D画面：ゾーニングのフォルダに置くと、ゾーニングのサービスワーカーが標高・写真を保存できる（部品は app/lib を共用）
z=open(os.path.join(ROOT,'app','3d.html'),encoding='utf-8').read().replace('src="./lib/','src="../app/lib/')
assert '../app/lib/viewer3d/' in z
open(os.path.join(ROOT,'zoning','3d.html'),'w',encoding='utf-8').write(z);print('updated zoning/3d.html')
