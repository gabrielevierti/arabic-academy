"""Pass 3: assemble lessons, exercises, solutions and resources for the app."""
from __future__ import annotations
import json, re, sys, copy
from pathlib import Path
from blocks import load, finalize, norm, isolate, join_lines

LEVEL = "C1"          # overridden by --level
BOOK_TITLE = "Competenza professionale"
LABEL = re.compile(r"^\(?([a-z]|\d{1,2})[).]?$")
INLINE_ITEM = re.compile(r"(?:(?<=^)|(?<=\s))([a-z])\)\s")


def plain(text: str) -> str:
    return re.sub(r"[⁦-⁩]", "", text)


LATIN_LETTER = re.compile(r"[A-Za-zÀ-ɏḀ-ỿ]")


def iso_full(text: str) -> str:
    """Isolate a whole Arabic-only string (with its punctuation); else isolate phrases."""
    t = plain(text).strip()
    if t and not LATIN_LETTER.search(t) and re.search(r"[\u0621-\u064a]", t):
        return "\u2067" + t + "\u2069"
    return isolate(text) if "\u2067" not in text else text


# --------------------------------------------------------------------------- outline alignment

def align_outline(toc, seq):
    """Attach outline entries to heading blocks; returns list of (entry, index)."""
    heads = [(i, b) for i, (pg, y, b) in enumerate(seq) if b["type"] in ("h1", "h2", "h3", "lead")]
    out = []
    hi = 0
    for level, title, page in toc:
        want = norm(title)
        found = None
        for k in range(hi, len(heads)):
            i, b = heads[k]
            pg = seq[i][0]
            if pg > page + 1:
                break
            if pg < page:
                continue
            if norm(b["text"]) == want or norm(b["text"]).startswith(want) and len(want) > 12:
                found = k
                break
        if found is None:
            print("UNMATCHED outline entry", level, title, page, file=sys.stderr)
            continue
        out.append((level, title, page, heads[found][0]))
        hi = found + 1
    return out


# --------------------------------------------------------------------------- block conversion

def convert(b):
    t = b["type"]
    if t in ("h1", "h2", "h3"):
        return {"type": "heading", "text": isolate(b["text"])}
    if t == "lead":
        return {"type": "heading", "text": isolate(b["text"]), "level": 4}
    if t == "part":
        return None
    return finalize(b)


def table_rows(b):
    """Raw rows (plain strings, header flag) of a pending table block."""
    return [r["cells"] for r in b["rows"]], bool(b["rows"] and b["rows"][0]["header"])


# --------------------------------------------------------------------------- items

def label_of(cell: str):
    m = LABEL.match(plain(cell).strip())
    return m.group(1) if m else None


def items_from_table(b):
    rows, header = table_rows(b)
    head = rows[0] if header else None
    body = rows[1:] if header else rows
    if not body:
        return None
    ncol = max(len(r) for r in body)
    # label columns: every body row has a label in that column
    label_cols = [c for c in range(ncol) if all(c < len(r) and (label_of(r[c]) or not plain(r[c]).strip()) for r in body)
                  and sum(1 for r in body if c < len(r) and label_of(r[c])) >= max(1, len(body) // 2)]
    if not label_cols:
        return None
    items = []
    groups = []
    for k, c in enumerate(label_cols):
        end = label_cols[k + 1] if k + 1 < len(label_cols) else ncol
        groups.append((c, list(range(c + 1, end))))
    for c, content_cols in groups:
        for r in body:
            lab = label_of(r[c]) if c < len(r) else None
            if not lab:
                continue
            parts = []
            for cc in content_cols:
                if cc >= len(r) or not plain(r[cc]).strip():
                    continue
                h = plain(head[cc]).strip() if head and cc < len(head) else ""
                parts.append((h + ": " if h and len(content_cols) > 1 else "") + r[cc])
            items.append({"id": lab, "prompt": " — ".join(parts)})
    return items


def items_from_inline(text: str):
    """Split «… : a) xxx · b) yyy» into an instruction and items."""
    t = text
    m = list(INLINE_ITEM.finditer(t))
    if len(m) < 2:
        return None
    letters = [x.group(1) for x in m]
    # must be a run a, b, c…
    seq = [ord(l) - 97 for l in letters]
    if seq[0] != 0:
        # allow material where only consecutive labels count
        return None
    good = [m[0]]
    for x in m[1:]:
        if ord(x.group(1)) - 97 == ord(good[-1].group(1)) - 97 + 1:
            good.append(x)
    if len(good) < 2:
        return None
    instruction = t[:good[0].start()].strip()
    items = []
    for k, x in enumerate(good):
        end = good[k + 1].start() if k + 1 < len(good) else len(t)
        body = t[x.end():end].strip()
        body = re.sub(r"\s*·\s*$", "", body).strip()
        items.append({"id": x.group(1), "prompt": body})
    return instruction, items


def items_from_numbers(text: str):
    m = list(re.finditer(r"(?:(?<=^)|(?<=\s))(\d{1,2})\.\s", text))
    good = []
    for x in m:
        n = int(x.group(1))
        if (not good and n == 1) or (good and n == int(good[-1].group(1)) + 1):
            good.append(x)
    if len(good) < 2:
        return None
    instruction = text[:good[0].start()].strip()
    items = []
    for k, x in enumerate(good):
        end = good[k + 1].start() if k + 1 < len(good) else len(text)
        items.append({"id": x.group(1), "prompt": text[x.end():end].strip().rstrip("·").strip()})
    return instruction, items


# --------------------------------------------------------------------------- solutions

SOL_MARK = re.compile(r"^Esercizio\s+(\d+\s?[a-z]?)\s*(?:[.·:]\s*|$)", re.I)


TERMINATOR = re.compile(r"^(Lettura|Script|Produzione orale|Produzione|Verifica|Ascolto|Dialogo|Ripasso|Test|Parte|Sezione|Simulazione|Profilo|Testi per)\b[^.]{0,80}[.·]?")


def solution_groups(raw_blocks):
    """Split solution blocks by «Esercizio N.» markers → ({id: blocks}, pre, {section title: blocks})"""
    groups, cur, key = {}, [], None
    pre = []
    named, nkey = {}, None
    for b in raw_blocks:
        text = plain(b.get("text", "")) if b["type"] != "table" else ""
        m = SOL_MARK.match(text) if b["type"] in ("lead", "paragraph", "h3", "h2") else None
        is_term = not m and (b["type"] in ("lead", "h3", "h2") or
                             b["type"] == "paragraph" and TERMINATOR.match(text) and re.match(r"^[^.]{0,90}[.·]", text))
        if is_term:
            if key is not None:
                groups[key] = cur
            key, cur = None, []
            pre.append(b)
            title = re.split(r"[.]\s", text + " ", maxsplit=1)[0].strip().rstrip(".")
            nkey = title
            named[nkey] = [] if b["type"] != "paragraph" else [dict(b, text=b["text"][len(b["text"]) - len(b["text"].lstrip()):])]
            if b["type"] == "paragraph":
                rest = re.split(r"(?<=[.])\s", b["text"], maxsplit=1)
                named[nkey] = [dict(b, text=rest[1])] if len(rest) > 1 and rest[1].strip() else []
            continue
        if m:
            if key is not None:
                groups[key] = cur
            nkey = None
            key = re.sub(r"\s+", "", m.group(1)).lower()
            cur = []
            raw = b["text"]
            mm = SOL_MARK.match(raw)
            rest = raw[mm.end():] if mm else raw
            if rest.strip():
                nb = dict(b)
                nb["type"] = "paragraph"
                nb["text"] = rest
                cur.append(nb)
            continue
        if key is None:
            pre.append(b)
            if nkey is not None:
                named[nkey].append(b)
        else:
            cur.append(b)
    if key is not None:
        groups[key] = cur
    return groups, pre, named


def solution_labels(raw_blocks):
    labels = {}
    subs = {}
    cur = None
    for b in raw_blocks:
        if b.get("_sub"):
            cur = b["_sub"]
            subs[cur] = []
            continue
        if cur:
            subs[cur].append(b)
    if subs:
        for k, bl in subs.items():
            labels[k] = flat([finalize(x) if x["type"] in ("table",) else {"type": "p", "text": x["text"]} for x in bl])
        return labels
    for b in raw_blocks:
        if b["type"] == "table":
            rows, header = table_rows(b)
            head = rows[0] if header else None
            body = rows[1:] if header else rows
            for r in body:
                for c, cell in enumerate(r):
                    lab = label_of(cell)
                    if not lab:
                        continue
                    # content until the next label cell
                    parts = []
                    for cc in range(c + 1, len(r)):
                        if label_of(r[cc]):
                            break
                        if plain(r[cc]).strip():
                            h = plain(head[cc]).strip() if head and cc < len(head) else ""
                            parts.append((h + ": " if h and len(r) > 2 else "") + r[cc])
                    if parts and lab not in labels:
                        labels[lab] = " · ".join(parts)
        elif b["type"] in ("paragraph", "list"):
            got = items_from_inline(b["text"])
            if got:
                for it in got[1]:
                    labels.setdefault(it["id"], it["prompt"])
            else:
                m = re.match(r"^([a-z])\)\s+(.*)$", plain(b["text"]))
                if m:
                    labels.setdefault(m.group(1), b["text"][b["text"].index(")") + 1:].strip())
                got = items_from_numbers(b["text"])
                if got:
                    for it in got[1]:
                        labels.setdefault(it["id"], it["prompt"])
    return labels


def flat(blocks):
    out = []
    for b in blocks:
        if b["type"] == "table":
            out.append(" · ".join(" | ".join(r) for r in b["rows"]))
        else:
            out.append(b["text"])
    return "\n".join(out).strip()


# --------------------------------------------------------------------------- lessons

def lesson_track(code):
    return code.split("-")[0]


def build(toc_path):
    toc, seq = load(toc_path)
    entries = align_outline(toc, seq)
    l1 = [(k, e) for k, e in enumerate(entries) if e[0] == 1]
    bounds = []
    for n, (k, e) in enumerate(l1):
        start = e[3]
        end = l1[n + 1][1][3] if n + 1 < len(l1) else len(seq)
        sub = [x for x in entries if start <= x[3] < end]
        bounds.append((e, start, end, sub))
    return seq, bounds


def section_blocks(seq, a, b):
    return [seq[i][2] for i in range(a, b)]


def make_exercise(eid, title, raw, sol_raw, single=False):
    """raw: raw blocks after the exercise heading."""
    blocks = [x for x in raw if x["type"] != "part"]
    instruction = ""
    items = None
    material = []
    used_table = None
    # 1. table with label column
    for i, b in enumerate(blocks if not single else []):
        if b["type"] == "table":
            its = items_from_table(b)
            if its and len(its) >= 2:
                items = its
                used_table = i
                break
    if items is not None:
        material = [convert(b) for k, b in enumerate(blocks) if k != used_table]
        if blocks and blocks[0]["type"] == "paragraph" and used_table != 0:
            instruction = blocks[0]["text"]
            material = [convert(b) for k, b in enumerate(blocks) if k not in (0, used_table)]
    else:
        # 2. inline lettered items in the first paragraph(s)
        for i, b in enumerate(blocks[:3] if not single else []):
            if b["type"] in ("paragraph",):
                got = items_from_inline(b["text"])
                if got and len(got[1]) >= 2:
                    instruction, items = got
                    if not instruction and i > 0 and blocks[0]["type"] == "paragraph":
                        instruction = blocks[0]["text"]
                    material = [convert(x) for k, x in enumerate(blocks) if k != i and not (k == 0 and instruction == x.get("text"))]
                    break
        if items is None:
            # 3. list blocks a) / 1.
            lst = [b for b in blocks if b["type"] == "list" and re.match(r"^([a-z]|\d{1,2})[).]\s", plain(b["text"]))]
            if len(lst) >= 2 and not single:
                items = []
                for b in lst:
                    m = re.match(r"^([a-z]|\d{1,2})[).]\s+", b["text"])
                    items.append({"id": m.group(1), "prompt": b["text"][m.end():]})
                rest = [b for b in blocks if b not in lst]
                if rest and rest[0]["type"] == "paragraph":
                    instruction = rest[0]["text"]
                    rest = rest[1:]
                material = [convert(b) for b in rest]
            else:
                # 4. numbered inline questions
                for i, b in enumerate(blocks[:2] if not single else []):
                    if b["type"] == "paragraph":
                        got = items_from_numbers(b["text"])
                        if got and len(got[1]) >= 2:
                            instruction, items = got
                            material = [convert(x) for k, x in enumerate(blocks) if k != i]
                            break
    if items is None:
        if blocks and blocks[0]["type"] == "paragraph":
            instruction = blocks[0]["text"]
            material = [convert(b) for b in blocks[1:]]
        else:
            material = [convert(b) for b in blocks]
        items = [{"id": "whole", "prompt": ""}]
    material = [m for m in material if m]
    # duplicate labels (two tables with a), b)…) → keep order, make ids unique
    seen = {}
    for it in items:
        base = it["id"]
        if base in seen:
            seen[base] += 1
            it["id"] = f"{base}{seen[base]}"
        else:
            seen[base] = 1
    # solutions
    sol_blocks = [convert(b) for b in (sol_raw or [])]
    sol_blocks = [b for b in sol_blocks if b]
    labels = solution_labels(sol_raw or [])
    full = flat(sol_blocks)
    out_items = []
    for it in items:
        model = labels.get(it["id"]) if it["id"] != "whole" else None
        if it["id"] == "whole" or (model is None and len(items) == 1):
            # a single prose answer is shown inline; structured solutions are rendered as blocks
            simple = [b for b in sol_blocks if b["type"] in ("paragraph", "list", "arabic")]
            model = sol_blocks[0]["text"] if len(sol_blocks) == 1 and simple else None
        q = {
            "id": it["id"],
            "prompt": iso_full(it["prompt"]),
            "model": iso_full(model) if model else "",
            "answers": [],
            "mode": "open",
            "explanation": full if full and full != (model or "") else "",
            "strictMarks": False,
        }
        out_items.append(q)
    group = {
        "id": eid,
        "title": isolate(title),
        "instruction": isolate(instruction) if instruction else "Leggi la consegna e prepara la tua risposta.",
        "blocks": material,
        "items": out_items,
        "solutionAvailable": bool(sol_blocks),
    }
    if sol_blocks:
        group["solutionBlocks"] = sol_blocks
    return group


def clean_title(t: str) -> str:
    return re.sub(r"[\u200e\u200f]", "", t).strip()


def ex_id(title):
    m = re.match(r"^Esercizio\s+(\d+)\s*([a-z])?\b", plain(title))
    if not m:
        return None
    return m.group(1) + (m.group(2) or "")


def main(pages_json, outdir):
    seq, bounds = build(pages_json)
    outdir = Path(outdir)
    (outdir / "course").mkdir(parents=True, exist_ok=True)
    titles = {e[1]: (e, s, t, sub) for e, s, t, sub in bounds}
    # solutions per code
    solutions = {}
    for e, s, t, sub in bounds:
        m = re.match(r"^Soluzioni · (.+)$", e[1])
        if m:
            solutions[m.group(1)] = (e, s, t)
    lessons, resources, metadata = [], [], {}
    for idx, (e, s, t, sub) in enumerate(bounds):
        title = clean_title(e[1])
        rid = f"{LEVEL}-resource-{idx}"
        res_blocks = [convert(seq[i][2]) for i in range(s, t)]
        res_blocks = [b for b in res_blocks if b]
        if res_blocks and res_blocks[0]["type"] == "heading" and norm(res_blocks[0]["text"]) == norm(title):
            res_blocks = res_blocks[1:]
        resources.append({"id": rid, "title": title, "blocks": res_blocks, "page": e[2]})
        m = re.match(r"^((" + re.escape(LEVEL) + r"|INT|EGY|MAG|ARZ)-\d+) · (.+)$", title)
        if not m:
            continue
        code, track, ltitle = m.group(1), m.group(2), m.group(3)
        lid = f"{LEVEL}-{code}"
        # chapters
        chapters, exercises, sections, ex_index = [], [], [], []
        l2 = [x for x in sub if x[0] == 2]
        sol = solutions.get(code)
        sol_groups, sol_pre, sol_named = solution_groups([seq[i][2] for i in range(sol[1] + 1, sol[2])]) if sol else ({}, [], {})
        ex_ids = {ex_id(y[1]) for y in sub if y[0] == 3 and ex_id(y[1])}
        for key in sorted(list(sol_groups)):
            mm = re.match(r"^(\d+)([a-z])$", key)
            if mm and key not in ex_ids and mm.group(1) in ex_ids:
                head = {"type": "paragraph", "text": mm.group(2) + ") "}
                body = sol_groups.pop(key)
                base = sol_groups.setdefault(mm.group(1), [])
                base.append({"type": "lead", "text": f"{mm.group(2)})", "_sub": mm.group(2)})
                base.extend(body)
        for n, x in enumerate(l2):
            a = x[3] + 1
            b = l2[n + 1][3] if n + 1 < len(l2) else t
            sections.append({"title": clean_title(x[1]), "page": x[2], "depth": 2})
            l3 = [y for y in sub if y[0] == 3 and a <= y[3] < b]
            blocks = []
            cursor = a
            pending_ex = []
            for k, y in enumerate(l3 + [None]):
                stop = y[3] if y else b
                # content before this sub-heading belongs to the previous sub-section
                chunk = [seq[i][2] for i in range(cursor, stop)]
                if pending_ex:
                    ey = pending_ex.pop()
                    eid = ex_id(ey[1])
                    grp = make_exercise(eid, clean_title(ey[1]), chunk, sol_groups.get(eid))
                    exercises.append(grp)
                    blocks.append({"type": "exercise", "id": eid, "title": isolate(clean_title(ey[1]))})
                else:
                    blocks.extend(c for c in (convert(z) for z in chunk) if c)
                if y is None:
                    break
                sections.append({"title": clean_title(y[1]), "page": y[2], "depth": 3})
                if ex_id(y[1]):
                    ex_index.append({"title": clean_title(y[1]), "page": y[2], "depth": 3})
                    pending_ex.append(y)
                else:
                    blocks.append({"type": "heading", "text": isolate(clean_title(y[1]))})
                cursor = y[3] + 1
            ctitle = plain(x[1])
            mcheck = re.match(r"^\d+\.\s+(Verifica dell'unità|Simulazione · ([A-E]) [^(]+?)\s*(\(.*\))?$", ctitle)
            if mcheck:
                name = mcheck.group(1).strip()
                gid = "verifica" if name.startswith("Verifica") else "sim-" + mcheck.group(2).lower()
                keys = list(sol_named)
                sol_key = next((k for k in keys if norm(k).startswith(norm(name))), None)
                sol_part = None
                if sol_key:
                    sol_part = list(sol_named[sol_key])
                    if gid.startswith("sim"):
                        for k in keys[keys.index(sol_key) + 1:]:
                            if re.match(r"^(Simulazione|Profilo|Testi per)", k):
                                break
                            sol_part.append({"type": "lead", "text": k})
                            sol_part.extend(sol_named[k])
                raw_chunk = [seq[i][2] for i in range(a, b)]
                grp = make_exercise(gid, name, raw_chunk, sol_part, single=True)
                grp["title"] = isolate(name if gid == "verifica" else name)
                exercises.append(grp)
                ex_index.append({"title": name, "page": x[2], "depth": 2})
                blocks.append({"type": "exercise", "id": gid, "title": isolate("Svolgi: " + name)})
            only_ex = all(bk["type"] == "exercise" for bk in blocks)
            chapters.append({"title": isolate(clean_title(x[1])), "blocks": blocks, **({"exercisesOnly": True} if only_ex else {})})
        # the unit header blocks before the first chapter (h1 only) are skipped
        sol_blocks = []
        if sol:
            sol_blocks = [c for c in (convert(seq[i][2]) for i in range(sol[1] + 1, sol[2])) if c]
        doc = {"id": lid, "title": ltitle, "chapters": chapters, "exercises": exercises, "solutionBlocks": sol_blocks}
        (outdir / "course" / f"{lid}.json").write_text(json.dumps(doc, ensure_ascii=False))
        n_items = sum(len(g["items"]) for g in exercises)
        visible = chapters
        lessons.append({
            "id": lid, "code": code, "level": LEVEL, "title": ltitle, "start": e[2],
            "end": (bounds[idx + 1][0][2] - 1) if idx + 1 < len(bounds) else e[2],
            "sections": sections, "exercises": ex_index,
            "solution": {"start": sol[0][2], "end": (next((bb[0][2] for bb in bounds if bb[0][2] > sol[0][2]), sol[0][2] + 1) - 1)} if sol else None,
            "track": track, "nativeChapters": len(visible), "nativeItems": n_items,
        })
        hours = None
        for ch in chapters[:1]:
            for bk in ch["blocks"]:
                if bk["type"] == "table":
                    for r in bk["rows"]:
                        if plain(r[0]).strip().lower().startswith("tempo stimato") and len(r) > 1:
                            mm = re.search(r"(\d+)\s*[–-]\s*(\d+)\s*ore", plain(r[1]))
                            if mm:
                                hours = [int(mm.group(1)), int(mm.group(2))]
                            else:
                                mm = re.search(r"(\d+)\s*ore", plain(r[1]))
                                if mm:
                                    hours = [int(mm.group(1)), int(mm.group(1))]
        metadata[lid] = {"hours": hours or [10, 12], "core": track == LEVEL, "chapters": len(visible), "questions": n_items}
    book = {"id": LEVEL, "title": BOOK_TITLE, "pages": seq[-1][0],
            "sections": [{"title": e[1], "page": e[2]} for e, s, t, sub in bounds],
            "resources": [{"id": r["id"], "title": r["title"]} for r in resources]}
    for r in resources:
        (outdir / "course" / f"{r['id']}.json").write_text(json.dumps({"id": r["id"], "title": r["title"], "blocks": r["blocks"]}, ensure_ascii=False))
    (outdir / "index.json").write_text(json.dumps({"book": book, "lessons": lessons, "metadata": metadata}, ensure_ascii=False, indent=1))
    print("lessons", len(lessons), "resources", len(resources), "items", sum(l["nativeItems"] for l in lessons))


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pages", help="JSON written by extract_pages.py")
    ap.add_argument("out", help="output directory")
    ap.add_argument("--level", default=LEVEL)
    ap.add_argument("--title", default=BOOK_TITLE, help="volume title shown in the library")
    args = ap.parse_args()
    LEVEL, BOOK_TITLE = args.level, args.title
    main(args.pages, args.out)
