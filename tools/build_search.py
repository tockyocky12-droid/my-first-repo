# 町ごとの版（app/・minamiosumi/・kimotsuki/）の地番検索用の一覧 data/search.json を作る。
# 1行が「大字の番号,地番,ファイルの番号」。検索で町の地番データを全部読まずに済む（通信量を減らす）。
# 地番データ（data/*.geojson）を入れ替えたら、もう一度実行する。
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for folder in ['app', 'minamiosumi', 'kimotsuki']:
    d = os.path.join(ROOT, folder, 'data'); idx = json.load(open(os.path.join(d, 'index.json'), encoding='utf-8'))
    files, rows = [], []
    for i, dd in enumerate(idx):
        files.append(dd['file'])
        for f in json.load(open(os.path.join(d, dd['file']), encoding='utf-8'))['features']:
            p = f['properties']; rows.append((p.get('大字名') or '', p.get('地番') or '', i))
    oz = sorted({r[0] for r in rows}); oi = {o: k for k, o in enumerate(oz)}
    s = json.dumps({'files': files, 'oaza': oz, 'rows': '\n'.join(f'{oi[o]},{c},{i}' for o, c, i in rows)}, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(d, 'search.json'), 'w', encoding='utf-8').write(s)
    print(folder, len(rows), '筆', round(len(s.encode()) / 1e6, 2), 'MB')
