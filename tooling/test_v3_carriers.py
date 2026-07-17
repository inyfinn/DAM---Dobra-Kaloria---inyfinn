"""Quick smoke test for v3 carrier grouping logic."""
import json, re

d = json.load(open('P:/DAM/apps/web/data/file-index.json', 'r', encoding='utf-8'))

CANON = [
    {'id':'BATONY','labels':['BATONY','BARS']},
    {'id':'KULKI','labels':['KULKI','BALLS']},
    {'id':'ROSLINNE','labels':['ROSLINNE','ROSLINNNE','PLANT BASED','PLANT-BASED']},
    {'id':'SYPKIE','labels':['SYPKIE','BREAKFAST']},
    {'id':'NAPOJE','labels':['NAPOJE','DRINKS']},
    {'id':'PRZETWORY','labels':['PRZETWORY','SPREADS','CREAMS','KREMY']},
    {'id':'DATESY','labels':['DATESY','DATES']},
]
CARRIER_LABELS = {
    'KAR6X':'KARTON 6x MINI BATONIKI','KAR':'KARTON',
    'DOY6X':'DOYPACK 6x MINI','DOY':'DOYPACK',
    'BAT':'BATON','MINI':'MINI BATONIK',
    'BIGPAK':'BIGPAK','TUBA':'TUBA','OBW':'OBWOLUTA',
    'ETY':'ETYKIETA','WARIANT':'WARIANT',
}

def strip_num(s):
    return re.sub(r'^\s*\d+\s*[-]\s*', '', s).strip()

def canon_id(cat):
    bare = strip_num(cat).upper()
    for c in CANON:
        for lbl in c['labels']:
            if bare == lbl.upper() or bare.startswith(lbl.upper()):
                return c['id']
    return bare or 'INNE'

def parse_carrier(folder):
    head = folder.split('-')[0].strip().upper().replace('_', ' ')
    if re.match(r'^KAR6X', head): return 'KAR6X'
    if re.match(r'^DOY6X', head): return 'DOY6X'
    if re.match(r'^KAR\b', head): return 'KAR'
    if re.match(r'^DOY\b', head): return 'DOY'
    if re.match(r'^MINI\b', head): return 'MINI'
    if re.match(r'^BAT\b|^BATON\b|^BAR\b', head): return 'BAT'
    if re.match(r'^\d{2}\.\d{2}\.\d{4}', head) or re.match(r'^\d{7}', head): return 'BAT'
    return head.split()[0] if head.split() else 'WARIANT'

def is_bogus(folder):
    n = folder.upper()
    if 'ELEMENTY Z OPAKOWA' in n: return True
    if re.match(r'^-\s*ELEMENTY', n.strip()): return True
    if re.match(r'^0\s*-\s*ARCHIWUM', n.strip()): return True
    return False

def clean_name(name):
    s = str(name or '')
    s = re.sub(r'\s*[-\u2014\u2013]\s*\[[^\]]*\]\s*$', '', s)
    s = re.sub(r'^\s*-\s*MIX\s*-\s*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'^\s*MIX\s*-\s*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'^\s*-\s*', '', s)
    return re.sub(r'\s+', ' ', s).strip() or name

def is_mix(name, tags):
    n = str(name or '')
    if re.search(r'\bMIX\b', n, re.IGNORECASE): return True
    if re.match(r'^\s*-\s*MIX', n, re.IGNORECASE): return True
    if isinstance(tags, list) and any(str(t).lower() == 'mix' for t in tags):
        return True
    return False

print("=== CANONICAL CATEGORIES ===")
merged = {}
for cat in d.get('categories', []):
    cid = canon_id(cat['name'])
    if cid not in merged:
        merged[cid] = {'id': cid, 'cats': [], 'count': 0}
    merged[cid]['cats'].append(cat['name'])

for p in d['products']:
    cid = canon_id(p.get('category', ''))
    if cid in merged:
        merged[cid]['count'] += 1

for k, v in merged.items():
    print(f"  {k}: {v['cats']} -> {v['count']} products")

print("\n=== BABKA CYTRYNOWA CARRIERS ===")
babka = next((p for p in d['products'] if 'BABKA' in (p.get('display_name') or '').upper()), None)
if babka:
    print("Product:", clean_name(babka.get('display_name', '')))
    groups = {}
    order = []
    for r in babka.get('revisions', []):
        folder = r['folder']
        if is_bogus(folder):
            print(f"  [BOGUS skip] {folder}")
            continue
        code = parse_carrier(folder)
        if code not in groups:
            groups[code] = []
            order.append(code)
        groups[code].append(r)

    for code in order:
        revs = groups[code]
        label = CARRIER_LABELS.get(code, code)
        latests = [r for r in revs if r.get('is_latest')]
        current = sorted(latests or revs, key=lambda r: float(r.get('index_rev') or 0), reverse=True)[0]
        older = [r for r in revs if r is not current]
        fbr = current.get('files_by_role') or {}
        has_ai = any((f.get('ext') or '').lower() in ('ai','psd','indd') for f in fbr.get('source',[]))
        has_druk = len(fbr.get('print',[])) > 0
        has_viz = len(fbr.get('viz',[])) > 0 or len(current.get('wizki',[]))>0
        slots = current.get('slots') or []
        has_elem = any('MATERIA' in str(s).upper() or 'ELEMENT' in str(s).upper() for s in slots)
        print(f"  {code} -> \"{label}\"")
        print(f"    current: {current['folder']} | idx: {current.get('index')} | older: {len(older)}")
        print(f"    checklist: AI={has_ai} druk={has_druk} viz={has_viz} elem_slot={has_elem}")

print("\n=== MIX PRODUCTS in BATONY ===")
batony = [p for p in d['products'] if canon_id(p.get('category','')) == 'BATONY']
mixes = [p for p in batony if is_mix(p.get('display_name',''), p.get('tags',[]))]
regulars = [p for p in batony if not is_mix(p.get('display_name',''), p.get('tags',[]))]
print(f"  MIXY: {len(mixes)}, Regular: {len(regulars)}")
for p in mixes[:5]:
    print(f"    MIX: {p['display_name']} -> clean: {clean_name(p['display_name'])}")

print("\nAll OK!")
