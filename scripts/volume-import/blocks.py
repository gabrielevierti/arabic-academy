"""Pass 2: turn decoded lines/tables into structured blocks following the PDF outline."""
from __future__ import annotations
import json, re, sys, unicodedata

ARABIC_CH = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
ARABIC_LETTER = re.compile(r"[ء-يٮ-ۓۺ-ۿݐ-ݿﭐ-﷿ﹰ-﻿]")
BLUE = [0.12, 0.23, 0.37]
LIST_MARK = re.compile(r"^(?:[•▪◦‣–-]\s|\d{1,2}[.)]\s|[a-z]\)\s)")
TOP_LIMIT = 75      # first line of a page starts above this y
BOTTOM_LIMIT = 760  # last line of a page ends below this y


def role(line):
    f, s, c = line["font"], line["size"], line["color"]
    if f == "Inter-Ultra-Bold":
        return "part"
    if f == "Inter-Bold" and s >= 14.5 and c == BLUE:
        return "h1"
    if f == "Inter-Bold" and abs(s - 12.5) < 0.2 and c == BLUE:
        return "h2"
    if f == "Inter-Bold" and abs(s - 10.5) < 0.2:
        return "h3"
    if f == "Inter-Bold" and abs(s - 9.6) < 0.2 and all(line["bold"]) and line["lat"] >= line["ar"]:
        return "lead"
    if s < 9.0 and not f.startswith("Naskh"):
        return "small"
    return "body"


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[‎‏⁦-⁩ً-ْٰ\s]", "", s)
    return s.lower()


def isolate(text: str) -> str:
    """Wrap Arabic phrases of a left-to-right text in RLI…PDI isolates."""
    if not ARABIC_LETTER.search(text):
        return text
    out, i, n = [], 0, len(text)
    while i < n:
        ch = text[i]
        if ARABIC_LETTER.match(ch):
            j = i
            last_strong = i
            while j < n:
                c = text[j]
                if ARABIC_CH.match(c):
                    if ARABIC_LETTER.match(c) or "٠" <= c <= "٩" or c in "ًٌٍَُِّْٰٕٓٔـ":
                        last_strong = j
                    elif c in "،؛؟٪٫٬":
                        last_strong = j
                    j += 1
                    continue
                if c in "  -–/.:()…" or c.isdigit():
                    # continue only if an Arabic letter follows before any Latin letter
                    k = j
                    while k < n and (text[k] in "  -–/.:()…" or text[k].isdigit()):
                        k += 1
                    if k < n and ARABIC_CH.match(text[k]):
                        j = k
                        continue
                break
            end = last_strong + 1
            seg = text[i:end]
            # keep balanced parentheses inside the isolate
            if seg.count("(") != seg.count(")"):
                seg2 = seg
                while seg2 and seg2.count("(") != seg2.count(")"):
                    seg2 = seg2[:-1]
                if seg2.strip():
                    seg = seg2
                    end = i + len(seg)
            out.append("⁧" + seg + "⁩")
            i = end
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def join_lines(parts: list[str]) -> str:
    text = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if not text:
            text = p
        elif text.endswith("-") and re.search(r"[A-Za-zÀ-ɏḀ-ỿʾʿ]-$", text) and re.match(r"[a-zʾʿḀ-ỿāīūḍḥṣṭẓǧšḫṯḏġ]", p):
            text += p  # transliteration broken after a hyphen (t-taqrīr)
        else:
            text += " " + p
    return re.sub(r"[ \t]+", " ", text).strip()


def line_text(line, rtl):
    return line["rtl"] if rtl else line["ltr"]


def paragraph_dir(lines):
    ar = sum(l["ar"] for l in lines)
    lat = sum(l["lat"] for l in lines)
    if ar == 0 or lat > ar:
        return False  # right-aligned Italian lines (e.g. an index with page numbers)
    al = [l["align"] for l in lines]
    if any(a is True for a in al) and not any(a is False for a in al):
        return True
    if any(a is False for a in al):
        return False
    ar = sum(l["ar"] for l in lines)
    lat = sum(l["lat"] for l in lines)
    return ar > lat


def same_paragraph(a, b):
    ra, rb = role(a), role(b)
    if ra != rb:
        return False
    if ra in ("h1", "h2", "h3", "part"):
        return b["y"] - a["y"] < 2.0 * b["size"] + 4
    a_ar = a["lat"] == 0 and a["ar"] > 0 and a["align"] is not False
    b_ar = b["lat"] == 0 and b["ar"] > 0 and b["align"] is not False
    if a["align"] is False and b["align"] is True or a["align"] is True and b["align"] is False:
        return False
    if a_ar or b_ar:
        if a_ar != b_ar:
            return False
        size = max(a["sizes"])
        return b["y"] - a["y"] <= 2.05 * size
    gap = b["top"] - a["bottom"]
    limit = 0.62 * max(a["size"], 7) if ra != "small" else 4.5
    if gap > limit:
        return False
    # a new list item starts a new block
    if LIST_MARK.match(b["ltr"]) and b["x0"] < a["x0"] - 3:
        return False
    if LIST_MARK.match(b["ltr"]) and abs(b["x0"] - a["x0"]) < 1 and LIST_MARK.match(a["ltr"]):
        return False
    return True


def build_units(pages):
    """Yield blocks per page sequence with cross-page continuation."""
    out = []  # (page, y, block)
    for p in pages:
        items = p["items"]
        para = []

        def flush():
            if not para:
                return
            rtl = paragraph_dir(para)
            r = role(para[0])
            text = join_lines([line_text(l, rtl) for l in para])
            if r in ("h1", "h2", "h3", "part"):
                b = {"type": r, "text": text}
            elif r == "lead":
                b = {"type": "lead", "text": text}
            elif rtl or all(l["lat"] == 0 and l["ar"] > 0 and l["align"] is not False for l in para):
                bold = all(l["firstFont"].endswith("Bold") and l["lastFont"].endswith("Bold") for l in para)
                b = {"type": "arabic", "text": text, **({"emphasis": True} if bold else {})}
            elif LIST_MARK.match(para[0]["ltr"]) and para[0]["x0"] > 47:
                b = {"type": "list", "text": text}
            else:
                b = {"type": "paragraph", "text": text}
                if r == "small":
                    b["small"] = True
            b["_first"] = para[0]
            b["_last"] = para[-1]
            out.append((p["page"], para[0]["top"], b))
            para.clear()

        for it in items:
            if it["kind"] == "table":
                flush()
                rows = []
                header = False
                for i, r in enumerate(it["rows"]):
                    cells = []
                    for c in r:
                        t = join_lines([l["text"] for l in c["lines"]])
                        cells.append(t)
                    if i == 0 and all(c["header"] for c in r):
                        header = True
                    rows.append({"cells": cells, "header": all(c["header"] for c in r),
                                 "rtl": [c["rtl"] for c in r], "x": [round(c["x0"]) for c in r]})
                out.append((p["page"], it["top"], {"type": "table", "rows": rows, "_top": it["top"],
                                                   "_bottom": it["bottom"], "_x": [round(c["x0"]) for c in it["rows"][-1]]}))
                continue
            if para and not same_paragraph(para[-1], it):
                flush()
            para.append(it)
        flush()
    return out


def merge_across_pages(seq):
    merged = []
    for page, y, b in seq:
        if merged:
            ppage, py, prev = merged[-1]
            if page == ppage + 1 and _first_on_page(seq, page, y):
                if prev["type"] == b["type"] == "table" and prev["_x"] == [r for r in b["rows"][0]["x"]] or \
                   prev["type"] == b["type"] == "table" and len(prev["rows"][-1]["cells"]) == len(b["rows"][0]["cells"]) and b["_top"] < 70 and prev["_bottom"] > 740:
                    rows = b["rows"]
                    if rows and rows[0]["header"] and prev["rows"][0]["header"] and rows[0]["cells"] == prev["rows"][0]["cells"]:
                        rows = rows[1:]
                    prev["rows"].extend(rows)
                    prev["_bottom"] = b["_bottom"]
                    merged[-1] = (page, py, prev)
                    continue
                if prev["type"] in ("paragraph", "list", "arabic") and b["type"] == ("paragraph" if prev["type"] == "list" else prev["type"]) \
                        and prev["_last"]["bottom"] > BOTTOM_LIMIT and b["_first"]["top"] < TOP_LIMIT \
                        and prev["_last"]["align"] is None and not LIST_MARK.match(b["_first"]["ltr"]):
                    prev["text"] = join_lines([prev["text"], b["text"]])
                    prev["_last"] = b["_last"]
                    merged[-1] = (page, py, prev)
                    continue
        merged.append((page, y, b))
    return merged


def _first_on_page(seq, page, y):
    return all(not (pg == page and yy < y - 0.5) for pg, yy, _ in seq)


def finalize(b):
    t = b["type"]
    if t == "table":
        rows = b["rows"]
        def cell(c, rtl):
            if not c.strip():
                return ""
            if rtl and ARABIC_LETTER.search(c):
                return "\u2067" + c + "\u2069"
            return isolate(c)
        out = {"type": "table", "rows": [[cell(c, rtl) for c, rtl in zip(r["cells"], r["rtl"])] for r in rows]}
        if not (rows and rows[0]["header"]):
            out["header"] = False
        return out
    text = b["text"]
    if t == "arabic":
        return {"type": "arabic", "text": "⁧" + text + "⁩", **({"emphasis": True} if b.get("emphasis") else {})}
    res = {"type": t, "text": isolate(text)}
    if b.get("small"):
        res["small"] = True
    return res


def load(path):
    d = json.load(open(path))
    seq = merge_across_pages(build_units(d["pages"]))
    return d["toc"], seq


if __name__ == "__main__":
    toc, seq = load(sys.argv[1])
    a, b_ = int(sys.argv[2]), int(sys.argv[3])
    for page, y, b in seq:
        if a <= page <= b_:
            f = finalize(b)
            if f["type"] == "table":
                print(page, "TABLE", "" if f.get("header", True) else "(no header)")
                for r in f["rows"]:
                    print("    |", " || ".join(r))
            else:
                print(page, f["type"].upper(), f["text"])
