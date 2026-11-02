# 錦江町版（app/）のアプリ本体を、ほかの町のフォルダへ写す。
# 町ごとに違うのは config.js・manifest.webmanifest・data/・kokuyu/ と、index.html のタイトル2か所だけ。
import shutil, re, sys, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOWNS={'minamiosumi':{'title':'南大隅町森林ナビ','short':'南大隅町森林ナビ'},
       'kimotsuki':{'title':'肝付町森林ナビ','short':'肝付町森林ナビ'},
       '../kagoshima-forest':{'title':'かごしま森林ナビ 大隅','short':'森林ナビ 大隅'}}
for d,t in TOWNS.items():
    h=open(os.path.join(ROOT,'app','index.html'),encoding='utf-8').read()
    h=h.replace('<title>錦江町森林ナビ</title>',f"<title>{t['title']}</title>",1)
    h=h.replace('<h1>錦江町森林ナビ</h1>',f"<h1>{t.get('h1',t['title'])}</h1>",1)
    h=h.replace('<meta name="apple-mobile-web-app-title" content="錦江町森林ナビ">',f"<meta name=\"apple-mobile-web-app-title\" content=\"{t['short']}\">",1)
    dst=os.path.normpath(os.path.join(ROOT,d))
    if not os.path.isdir(dst):print('skip',d,'(フォルダがありません)');continue  # かごしま版は別のリポジトリ（kagoshima-forest）
    open(os.path.join(dst,'index.html'),'w',encoding='utf-8').write(h)
    shutil.copy(os.path.join(ROOT,'app','sw.js'),os.path.join(dst,'sw.js'))
    print('updated',d)
