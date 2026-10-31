"""Pass 1: decode every page of the volume into flow lines and tables (JSON cache)."""
import json, sys, time
import pymupdf
from pdftext import FontBook, LATIN
from layout import analyze, line_direction, set_text

PDF = sys.argv[1]
OUT = sys.argv[2]
doc = pymupdf.open(PDF)
book = FontBook(doc)


def style_of(line):
    font, size, color = line.style()
    return {"font": font, "size": size, "color": list(color)}


def cell_rtl(lines, x0, x1):
    votes = [line_direction(l, x0 + 4, x1 - 4) for l in lines]
    v = [x for x in votes if x is not None]
    a = sum(l.arabic_count for l in lines)
    b = sum(l.latin_count for l in lines)
    if v:
        return sum(v) > len(v) / 2
    return a > b


def line_record(l, texts):
    # style of the leftmost / rightmost non-space piece
    ps = sorted(l.pieces, key=lambda p: p.x0)
    return {
        "y": round(l.y, 2), "x0": round(l.x0, 2), "x1": round(l.x1, 2), "top": round(l.top, 2),
        "bottom": round(l.bottom, 2), **texts, **style_of(l),
        "ar": l.arabic_count, "lat": l.latin_count,
        "bold": [p.bold for p in ps], "fonts": sorted({p.font for p in l.pieces}),
        "sizes": sorted({round(p.size, 1) for p in l.pieces}),
        "firstFont": ps[0].font, "lastFont": ps[-1].font,
        "firstBold": ps[0].bold, "lastBold": ps[-1].bold,
        "color0": list(ps[0].color),
    }


pages = []
t0 = time.time()
for pno in range(1, len(doc) + 1):
    page = doc[pno - 1]
    flow, tables = analyze(page, book, pno)
    recs = []
    for l in flow:
        set_text([l], False)
        ltr = l.text
        set_text([l], True)
        rtl = l.text
        d = line_direction(l, 45.35, 549.92)
        recs.append({"kind": "line", **line_record(l, {"ltr": ltr, "rtl": rtl}), "align": d})
    for t in tables:
        rows = []
        for r in t.rows:
            cells = []
            for c in r:
                rtl = cell_rtl(c.lines, c.x0, c.x1)
                set_text(c.lines, rtl)
                cells.append({"x0": round(c.x0, 2), "x1": round(c.x1, 2), "y0": round(c.y0, 2), "y1": round(c.y1, 2),
                              "header": c.header, "rtl": rtl,
                              "lines": [{"text": ln.text, "y": round(ln.y, 2), "x0": round(ln.x0, 2), "x1": round(ln.x1, 2),
                                         "size": ln.size, "font": ln.style()[0], "bold": all(p.bold for p in ln.pieces if not p.arabic) and any(not p.arabic for p in ln.pieces)}
                                        for ln in c.lines]})
            rows.append(cells)
        recs.append({"kind": "table", "y": round(t.top, 2), "top": round(t.top, 2), "bottom": round(t.bottom, 2),
                     "x0": round(t.x0, 2), "x1": round(t.x1, 2), "rows": rows})
    recs.sort(key=lambda r: (r["top"] if r["kind"] == "table" else r["top"], r.get("x0", 0)))
    pages.append({"page": pno, "items": recs})
    if pno % 50 == 0:
        print(pno, round(time.time() - t0, 1), flush=True)
json.dump({"toc": doc.get_toc(), "pages": pages}, open(OUT, "w"), ensure_ascii=False)
print("done", len(pages), round(time.time() - t0, 1))
