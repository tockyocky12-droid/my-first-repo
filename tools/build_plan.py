"""錦江町森林整備計画（R5.4.1〜R15.3.31）別表２から、主伐の伐期齢の下限がかかる区域（※1〜※3）を取り出す。
使い方: pdftotext -f 23 -l 26 -raw 計画書.pdf t.txt; python3 build_plan.py t.txt 出力.json
出力: {"z":{"1":{"大根占":[規則...],"田代":[...]},...}}  規則=[林班, 準林班の集合|null, [小班の始め,終わり]|null, 枝番の集合|null]
"""
import re,sys,json,unicodedata
KANA='ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ'
t=open(sys.argv[1],encoding='utf-8').read()
t=re.sub(r'- 2\d -\n','',t)
i1=t.index('※１\n',t.index('【別表２】'));i2=t.index('942.61',i1);i3=t.index('※２\n',i2);i4=t.index('427.49',i3);i5=t.index('※３\n',i4);i6=t.index('複\n層',i5)
parts={'1':t[i1+3:i2],'2':t[i3+3:i4],'3':t[i5+3:i6].replace('391.83','')}
def kset(s):
    if '～' in s:a,b=s.split('～');return KANA[KANA.index(a):KANA.index(b)+1]
    return s
def parse(body):
    out={'大根占':[],'田代':[]};cur=None
    body=body.replace('\n','')
    for tok in re.split(r'(大根占地区|田代地区|，|,)',body):
        tok=tok.strip()
        if not tok or tok in ('，',','):continue
        if tok.endswith('地区'):cur=tok[:-2];continue
        seg=[x for x in re.split(r'[‐-]',tok) if x!='']
        r=int(seg[0]);j=s=e=None
        if len(seg)>1:j=kset(seg[1])
        if len(seg)>2:
            a=seg[2].split('～');s=[int(a[0]),int(a[-1])]
        if len(seg)>3:e=kset(seg[3])
        if len(seg)>4:raise ValueError(tok)
        nf=lambda x:unicodedata.normalize('NFKC',x) if x else None
        out[cur].append([r,nf(j),s,nf(e)])
    return out
res={'z':{k:parse(v) for k,v in parts.items()},
     'std':{'スギ':35,'ヒノキ':40,'マツ':30,'その他針':40,'クヌギ':10,'その他広':20},
     'src':'錦江町森林整備計画書（計画期間 令和5年4月1日〜令和15年3月31日）別表２'}
for k,v in res['z'].items():print(k,{d:len(x) for d,x in v.items()})
json.dump(res,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
