"""Groups the Google fonts by look for the Studio's font browser (Danielle,
24 Nov 2026: "I have no idea which one is which").

Run now and then with the two public catalogues downloaded beside it:
  curl -s https://fonts.google.com/metadata/fonts -o meta.json
  curl -s https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv -o tags.csv
  python3 scripts/font-groups.py meta.json tags.csv > src/data/google-font-groups.js

Groups: h handwriting, c calligraphy, b bold, m minimal (clean sans),
s classic (serif). Each list runs most popular first. Fonts for other
scripts, symbols, monospace and novelty themes are left out of every group.
"""
import json, csv, collections, sys
META, TAGS = sys.argv[1], sys.argv[2]
s=open(META).read(); d=json.loads(s[s.index('{'):]); fl={f['family']:f for f in d['familyMetadataList']}
T=collections.defaultdict(dict); A=collections.defaultdict(lambda: collections.defaultdict(list))
for row in csv.reader(open(TAGS)):
    if len(row)>=4 and row[2].startswith('/'):
        try: val=float(row[3])
        except: continue
        if row[1]=='': T[row[0]][row[2]]=val
        else: A[row[0]][row[2]].append(val)
for fam,tags in A.items():
    if fam not in T:   # a variable font tagged per instance only: the average
        T[fam]={k:sum(v)/len(v) for k,v in tags.items()}
HAND={'Homemade Apple'}
BOLD={'Bebas Neue','Oswald','Anton','Archivo Black','Fjalla One','League Spartan','Alfa Slab One','Abril Fatface','Bungee','Passion One','Ultra','Big Shoulders Display','Teko','League Gothic','Antonio','Bowlby One','Bowlby One SC','Staatliches','Squada One','Six Caps','Francois One','Russo One','Black Ops One','Paytone One','Titan One','Luckiest Guy','Chango','Rammetto One','Sigmar One','Dela Gothic One','Climate Crisis','Rubik Mono One','Monoton'}
def g(name):
    f=fl.get(name); t=T.get(name,{})
    if not f: return None
    if f.get('primaryScript') or 'Symbols' in (f.get('classifications') or []) or f['category']=='Monospace': return None
    if 'latin' not in f['subsets']: return None
    cat=f['category']; v=lambda k:t.get(k,0)
    if name in HAND: return 'h'
    if v('/Script/Formal')>=20 or (cat=='Handwriting' and v('/Script/Upright Script')>=40 and v('/Script/Informal')<40 and v('/Expressive/Fancy')>=20): return 'c'
    if cat=='Handwriting' or v('/Script/Handwritten')>=20 or v('/Script/Informal')>=20 or v('/Theme/Brush')>=30: return 'h'
    themed=any(v(k)>=30 for k in ('/Theme/Wacky','/Theme/Pixel','/Theme/Blobby','/Theme/Techno','/Theme/Distressed','/Theme/Blackletter','/Theme/Medieval','/Theme/Shaded','/Theme/Inline','/Theme/Stencil','/Theme/Tuscan'))
    if themed: return None
    if name in BOLD or v('/Expressive/Loud')>=50 or v('/Serif/Fat Face')>=30: return 'b'
    if cat=='Sans Serif' and v('/Expressive/Childlike')<50: return 'm'
    if cat=='Serif': return 's'
    return None

by = collections.defaultdict(list)
for n, f in fl.items():
    k = g(n)
    if k: by[k].append((f['popularity'], n))
print("// Made by scripts/font-groups.py from Google's own catalogue and style tags")
print("// (fonts.google.com/metadata/fonts, google/fonts tags/all/families.csv).")
print("// Most popular first. h handwriting, c calligraphy, b bold, m minimal, s classic.")
print("export const FONT_GROUPS = " + json.dumps({k: [n for _, n in sorted(by[k])] for k in "hcbms"}, indent=0, ensure_ascii=False) + ";")
