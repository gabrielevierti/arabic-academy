import sys, re, unicodedata, pymupdf, random
from bidi.algorithm import get_display
from pdftext import FontBook, decode_arabic, _is_mark, logical_line
from layout import analyze, line_direction
doc = pymupdf.open(sys.argv[1]); book = FontBook(doc)
def visual(line):
    out = []
    for p in sorted(line.pieces, key=lambda p: p.x0):
        if p.arabic:
            # decode each cluster separately in visual order: marks precede base
            cl = []
            for g in p.glyphs:
                cl.append(g.name)
                if not _is_mark(g.name):
                    # cluster = base followed by its marks in logical order
                    base = cl[-1]; marks = cl[:-1]
                    out.append(decode_arabic([base] + marks)); cl = []
        else:
            out.append(''.join(g.text for g in p.glyphs))
    return ''.join(out)
def core(s):
    s = unicodedata.normalize('NFD', s)
    s = re.sub(r'[ً-ْٰٓ-ٕ\s⁦-⁩]', '', s)
    return unicodedata.normalize('NFC', s)
random.seed(1)
pages = sorted(random.sample(range(len(doc)), int(sys.argv[2])))
bad = total = 0
for pno in pages:
    flow, tables = analyze(doc[pno], book, pno + 1)
    lines = list(flow) + [l for t in tables for r in t.rows for c in r for l in c.lines]
    for l in lines:
        if not any(p.arabic for p in l.pieces): continue
        total += 1
        v = core(visual(l))
        ok = False
        for rtl in (False, True):
            logical = logical_line([p.glyphs for p in l.pieces], rtl)
            disp = get_display(logical, base_dir='R' if rtl else 'L')
            if core(disp) == v: ok = True; break
        if not ok:
            bad += 1
            if bad <= 8:
                print('PAGE', pno + 1, '\n  vis', v[:150], '\n  ltr', core(get_display(logical_line([p.glyphs for p in l.pieces], False), base_dir='L'))[:150])
print('lines with Arabic', total, 'mismatches', bad)
