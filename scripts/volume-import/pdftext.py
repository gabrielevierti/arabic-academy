"""Low-level text recovery for the Arabic Academy volume PDFs (WeasyPrint output).

The PDFs embed subset fonts whose ToUnicode maps are unreliable for Arabic: Noto
Naskh Arabic composes letters from a dotless body plus separate dot glyphs, and
WeasyPrint writes the first cluster text it met for every glyph. Glyph identities
are therefore recovered from the outlines (see build_glyph_map) and Arabic text is
rebuilt from body+dots clusters with a table derived by shaping the reference font.
Line order is recovered by inverting the Unicode bidi reordering on visual runs.
"""
from __future__ import annotations
import io, json, math, re, unicodedata
from pathlib import Path
from functools import lru_cache

import pymupdf
from fontTools.ttLib import TTFont
from fontTools.pens.statisticsPen import StatisticsPen
from fontTools.pens.boundsPen import BoundsPen

HERE = Path(__file__).resolve().parent
REFERENCE = {
    "Naskh": HERE / "fonts" / "noto-naskh-arabic-arabic-400-normal.woff",
    "Naskh-Bold": HERE / "fonts" / "noto-naskh-arabic-arabic-700-normal.woff",
}

# --------------------------------------------------------------------------- glyph identity

def _features(font: TTFont, name: str):
    gs = font.getGlyphSet()
    g = gs[name]
    sp = StatisticsPen(glyphset=gs)
    g.draw(sp)
    bp = BoundsPen(gs)
    g.draw(bp)
    if not bp.bounds:
        return None
    return (g.width, *bp.bounds, sp.area, sp.meanX, sp.meanY,
            math.sqrt(abs(sp.varianceX)), math.sqrt(abs(sp.varianceY)))


def _distance(a, b):
    return sum(abs(x - y) for i, (x, y) in enumerate(zip(a, b)) if i != 5) + abs(a[5] - b[5]) / 50


PREFERRED = re.compile(r"^(uni0[67][0-9A-F]{2}|kafDotlessar|miniKehehar|gafsarkashabovear|"
                       r"(dot|twodots|threedots)[a-z]+ar$|uni0651|space|period|colon|exclam)")


def build_glyph_map(subset_bytes: bytes, reference: Path) -> dict[int, str]:
    """Map every glyph id of an embedded subset font to a reference glyph name."""
    sub = TTFont(io.BytesIO(subset_bytes))
    ref = TTFont(str(reference))
    refs = []
    for n in ref.getGlyphOrder():
        try:
            f = _features(ref, n)
        except Exception:
            f = None
        if f:
            refs.append((n, f))
    cmap = {g: u for u, g in (sub.getBestCmap() or {}).items()}
    names = {}
    order = sub.getGlyphOrder()
    for gid, n in enumerate(order):
        f = _features(sub, n)
        if not f:
            if n == "space" or cmap.get(n) == 32:
                names[gid] = "space"
            continue
        scored = sorted((_distance(f, fr), rn) for rn, fr in refs)
        best = scored[0][0]
        ties = [rn for d, rn in scored if d <= best + 0.5]
        # Prefer the subset's own cmap, then names the shaping table knows.
        if n in cmap and cmap[n] > 32:
            u = cmap[n]
            want = {"uni%04X" % u}
            match = [t for t in ties if t in want]
            if match:
                names[gid] = match[0]
                continue
            if 0x20 < u < 0x7F or u in (0x25CC, 0xFDFA, 0xFDF2, 0xFD3E, 0xFD3F, 0x060C, 0x061B, 0x061F, 0x066A, 0x066B, 0x066C):
                names[gid] = "uni%04X" % u
                continue
        ties.sort(key=lambda t: (not PREFERRED.match(t), len(t)))
        names[gid] = ties[0]
    return names


# --------------------------------------------------------------------------- Arabic clusters

LETTERS = {
    ("uni0621", frozenset()): "ء",
    ("uni0627", frozenset()): "ا",
    ("uni0627", frozenset({"uni0653"})): "آ",
    ("uni0627", frozenset({"uni0654"})): "أ",
    ("uni0627", frozenset({"uni0655"})): "إ",
    ("uni0648", frozenset()): "و",
    ("uni0648", frozenset({"uni0654"})): "ؤ",
    ("uni0649", frozenset({"uni0654"})): "ئ",
    ("uni066E", frozenset({"uni0654"})): "ئ",
    ("uni066E", frozenset({"dotbelowar"})): "ب",
    ("uni066E", frozenset({"twodotshorizontalabovear"})): "ت",
    ("uni066E", frozenset({"threedotsupabovear"})): "ث",
    ("uni066E", frozenset({"dotabovear"})): "ن",
    ("uni066E", frozenset({"twodotshorizontalbelowar"})): "ي",
    ("uni066E", frozenset({"threedotsdownbelowar"})): "پ",
    ("uni066E", frozenset()): "ى",
    ("uni0649", frozenset({"twodotshorizontalbelowar"})): "ي",
    ("uni0649", frozenset()): "ى",
    ("uni06BA", frozenset({"dotabovear"})): "ن",
    ("uni06BA", frozenset()): "ں",
    ("uni06D5", frozenset({"twodotshorizontalabovear"})): "ة",
    ("uni06C1", frozenset({"twodotshorizontalabovear"})): "ة",
    ("uni0647", frozenset({"twodotshorizontalabovear"})): "ة",
    ("uni0647", frozenset()): "ه",
    ("uni06D5", frozenset()): "ه",
    ("uni06C1", frozenset()): "ه",
    ("uni062D", frozenset()): "ح",
    ("uni062D", frozenset({"dotcenterar"})): "ج",
    ("uni062D", frozenset({"dotbelowar"})): "ج",
    ("uni062D", frozenset({"dotabovear"})): "خ",
    ("uni062D", frozenset({"threedotsdowncenterar"})): "چ",
    ("uni062D", frozenset({"threedotsdownbelowar"})): "چ",
    ("uni062F", frozenset()): "د",
    ("uni062F", frozenset({"dotabovear"})): "ذ",
    ("uni0631", frozenset()): "ر",
    ("uni0631", frozenset({"dotabovear"})): "ز",
    ("uni0633", frozenset()): "س",
    ("uni0633", frozenset({"threedotsupabovear"})): "ش",
    ("uni0635", frozenset()): "ص",
    ("uni0635", frozenset({"dotabovear"})): "ض",
    ("uni0637", frozenset()): "ط",
    ("uni0637", frozenset({"dotabovear"})): "ظ",
    ("uni0639", frozenset()): "ع",
    ("uni0639", frozenset({"dotabovear"})): "غ",
    ("uni06A1", frozenset({"dotabovear"})): "ف",
    ("uni06A1", frozenset({"twodotshorizontalabovear"})): "ق",
    ("uni06A1", frozenset({"threedotsupabovear"})): "ڤ",
    ("uni06A1", frozenset()): "ڡ",
    ("uni066F", frozenset({"twodotshorizontalabovear"})): "ق",
    ("uni066F", frozenset()): "ٯ",
    ("kafDotlessar", frozenset({"miniKehehar"})): "ك",
    ("kafDotlessar", frozenset()): "ک",
    ("uni0643", frozenset()): "ك",
    ("uni0643", frozenset({"gafsarkashabovear"})): "گ",
    ("uni06A9", frozenset({"gafsarkashabovear"})): "گ",
    ("uni06A9", frozenset()): "ک",
    ("uni0644", frozenset()): "ل",
    ("uni0645", frozenset()): "م",
    ("uni0640", frozenset()): "ـ",
}
COMPONENT_MARKS = {"dotabovear", "dotbelowar", "twodotshorizontalabovear", "twodotshorizontalbelowar",
                   "threedotsupabovear", "threedotsdownbelowar", "threedotsdownabovear", "dotcenterar",
                   "threedotsdowncenterar", "twodotsverticalabovear", "miniKehehar", "gafsarkashabovear",
                   "uni0653", "uni0654", "uni0655", "tahabovear"}
MARK_TEXT = {
    "uni064B": "ً", "uni064C": "ٌ", "uni064D": "ٍ", "uni064E": "َ",
    "uni064F": "ُ", "uni0650": "ِ", "uni0651": "ّ", "uni0652": "ْ",
    "uni0670": "ٰ", "uni0653": "ٓ", "uni0654": "ٔ", "uni0655": "ٕ",
    "uni06E4": "ٓ", "fathaattachedrightar": "َ", "kasraattachedar": "ِ",
    "kasraattachedrightar": "ِ", "uni0651064B": "ًّ", "uni0651064C": "ٌّ",
    "uni0651064D": "ٍّ", "uni0651064E": "َّ", "uni0651064F": "ُّ",
    "uni06510650": "ِّ", "uni06510670": "ّٰ", "uni06510670.small": "ّٰ",
    "uni06DF": "َّ", "uni06E1": "ُّ", "uni08EB": "ِّ",
}
OTHER_TEXT = {"space": " ", "period": ".", "colon": ":", "exclam": "!", "uni25CC": "",
              "sallaallahar": "ﷺ", "uniFDFA": "ﷺ", "uniFDF2": "الله", "uniFDF2.2": "الله"}


def _base(name: str) -> str:
    m = re.match(r"(uni[0-9A-F]{4}|kafDotlessar)", name)
    return m.group(1) if m else name


def _is_mark(name: str) -> bool:
    return name in COMPONENT_MARKS or name in MARK_TEXT or (
        ("dot" in name and name.endswith("ar")) and not name.startswith("uni"))


def decode_arabic(names: list[str]) -> str:
    """Decode reference glyph names in logical order into Unicode text."""
    out = []
    cluster: list[str] = []

    def flush():
        if not cluster:
            return
        base, marks = cluster[0], cluster[1:]
        b = _base(base)
        comps = frozenset(m for m in marks if m in COMPONENT_MARKS and m not in ("uni0653", "uni0654", "uni0655"))
        hamza = [m for m in marks if m in ("uni0653", "uni0654", "uni0655")]
        vowels = [MARK_TEXT[m] for m in marks if m in MARK_TEXT and m not in ("uni0653", "uni0654", "uni0655")]
        letter = None
        if (b, comps | frozenset(hamza)) in LETTERS:
            letter = LETTERS[(b, comps | frozenset(hamza))]
            hamza = []
        elif (b, comps) in LETTERS:
            letter = LETTERS[(b, comps)]
        elif base in OTHER_TEXT:
            letter = OTHER_TEXT[base]
        elif re.fullmatch(r"uni[0-9A-F]{4}(\..*)?", base):
            letter = chr(int(base[3:7], 16))
        else:
            letter = "�"
        out.append(letter + "".join(MARK_TEXT[h] for h in hamza) + "".join(vowels))
        cluster.clear()

    for n in names:
        if _is_mark(n) and cluster:
            cluster.append(n)
        elif _is_mark(n):
            # a mark without base (e.g. after a dotted circle)
            out.append(MARK_TEXT.get(n, ""))
        else:
            flush()
            cluster.append(n)
    flush()
    return unicodedata.normalize("NFC", "".join(out))


# --------------------------------------------------------------------------- fonts of a document

MIRROR = str.maketrans("()[]{}<>«»‹›", ")(][}{><»«›‹")
ARABIC = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
LATIN = re.compile(r"[A-Za-zÀ-ɏḀ-ỿ]")


class FontBook:
    def __init__(self, doc: pymupdf.Document):
        self.doc = doc
        self.maps: dict[str, dict] = {}
        self._load()

    def _load(self):
        seen = {}
        for pno in range(len(self.doc)):
            for f in self.doc.get_page_fonts(pno):
                xref, basefont = f[0], f[3]
                short = basefont.split("+", 1)[-1]
                seen[short] = xref
            if len(seen) >= 9:
                break
        for short, xref in seen.items():
            name, ext, typ, buf = self.doc.extract_font(xref)
            entry = {"short": short}
            if short in REFERENCE:
                entry["arabic"] = build_glyph_map(buf, REFERENCE[short])
                ref = TTFont(str(REFERENCE[short]))
                gdef = ref["GDEF"].table.GlyphClassDef.classDefs
                entry["gdef"] = gdef
            else:
                from fontTools import agl
                font = TTFont(io.BytesIO(buf))
                order = font.getGlyphOrder()
                rev = {}
                for u, g in sorted((font.getBestCmap() or {}).items()):
                    if 0xE000 <= u <= 0xF8FF:
                        continue  # private-use aliases of stylistic alternates
                    rev.setdefault(g, chr(u))
                latin = {}
                for gid, n in enumerate(order):
                    if n in rev:
                        latin[gid] = rev[n]
                        continue
                    stem = n.split(".")[0]
                    if stem in rev:
                        latin[gid] = rev[stem]
                    elif stem and stem not in (".notdef",):
                        t = agl.toUnicode(stem.replace("_", " ").split(" ")[0]) if "_" not in stem else agl.toUnicode(stem)
                        if t:
                            latin[gid] = t
                entry["latin"] = latin
            self.maps[short] = entry

    def kind(self, font: str) -> str:
        return "arabic" if "arabic" in self.maps.get(font, {}) else "latin"


# --------------------------------------------------------------------------- page glyphs

class Glyph:
    __slots__ = ("font", "size", "bold", "italic", "color", "x0", "x1", "y", "top", "bottom",
                 "name", "text", "arabic", "span")

    def __repr__(self):
        return f"<{self.text or self.name}@{self.x0:.1f},{self.y:.1f}>"


def page_glyphs(page: pymupdf.Page, book: FontBook) -> list[list[Glyph]]:
    """Return text spans (lists of glyphs in visual order) for a page."""
    spans = []
    for si, s in enumerate(page.get_texttrace()):
        font = s["font"]
        entry = book.maps.get(font)
        chars = s["chars"]
        size = s["size"]
        bold = "Bold" in font or bool(s["flags"] & 16)
        italic = "Italic" in font
        color = tuple(round(c, 2) for c in (s.get("color") or (0, 0, 0)))
        if s.get("opacity", 1) == 0:
            continue
        glyphs = []
        i = 0
        while i < len(chars):
            u, gid, origin, bbox = chars[i]
            extra = ""
            j = i + 1
            while j < len(chars) and chars[j][1] == -1:
                extra += chr(chars[j][0]) if chars[j][0] > 0 else ""
                j += 1
            i = j
            if gid < 0:
                continue
            g = Glyph()
            g.font, g.size, g.bold, g.italic, g.color = font, size, bold, italic, color
            g.x0, g.y = origin
            g.x1 = bbox[2]
            g.top, g.bottom = bbox[1], bbox[3]
            g.span = si
            if entry and "arabic" in entry:
                g.arabic = True
                g.name = entry["arabic"].get(gid, "space" if u == 32 else None)
                if g.name is None:
                    g.name = "uni%04X" % u if u > 0 else ".notdef"
                g.text = None
            else:
                g.arabic = False
                g.name = None
                t = entry["latin"].get(gid) if entry else None
                if t is None:
                    t = (chr(u) if u > 0 else "") + extra
                g.text = t
            glyphs.append(g)
        if glyphs:
            spans.append(glyphs)
    return spans


# --------------------------------------------------------------------------- bidi inversion

def _span_class(glyphs: list[Glyph]) -> str:
    if glyphs[0].arabic:
        names = [g.name for g in glyphs]
        if any(_base(n) in {k[0] for k in LETTERS} or n.startswith("uniFDF") for n in names if not _is_mark(n)):
            return "R"
        if any(re.match(r"uni06[67][0-9]|uni06F[0-9]", n) for n in names) and all(
                re.match(r"uni06[67][0-9]|uni06F[0-9]|uni066[BC]", n) or n in
                ("period", "uni002E", "colon", "uni003A", "comma", "uni002C", "uni060C", "slash", "uni002F")
                for n in names if not _is_mark(n)):
            return "AN"
        if all(n == "space" for n in names):
            return "N"
        return "R"
    text = "".join(g.text for g in glyphs)
    if LATIN.search(text):
        return "L"
    if ARABIC.search(text):
        return "R"
    if re.search(r"\d", text):
        return "EN"
    return "N"


def _latin_units(glyphs: list[Glyph]) -> list[tuple[list[Glyph], str]]:
    """Split a Latin span into L / EN / N runs (glyph text based)."""
    units = []
    for g in glyphs:
        t = g.text or ""
        if LATIN.search(t) or (t and t[0].isalpha()):
            c = "L"
        elif t and t[0].isdigit():
            c = "EN"
        else:
            c = "N"
        if units and units[-1][1] == c and c != "N":
            units[-1][0].append(g)
        else:
            units.append(([g], c))
    # separators and terminators inside numbers / words belong to them (e.g. 2.700, 27%, l'anno)
    merged = []
    for i, (gl, c) in enumerate(units):
        if c == "N" and 0 < i < len(units) - 1:
            prev_c, next_c = units[i - 1][1], units[i + 1][1]
            txt = "".join(g.text for g in gl)
            if prev_c == next_c and prev_c in ("EN", "L") and len(txt) == 1 and txt in ".,:/'’-‑":
                merged.append((gl, prev_c))
                continue
        if c == "N" and i > 0 and units[i - 1][1] == "EN" and "".join(g.text for g in gl) in ("%", "‰"):
            merged.append((gl, "EN"))
            continue
        merged.append((gl, c))
    out = []
    for gl, c in merged:
        if out and out[-1][1] == c:
            out[-1][0].extend(gl)
        else:
            out.append((list(gl), c))
    return out


def logical_line(spans: list[list[Glyph]], rtl: bool) -> str:
    """Rebuild the logical text of one visual line made of spans (each in visual order)."""
    spans = sorted(spans, key=lambda s: min(g.x0 for g in s))
    units: list[tuple[list[Glyph], str]] = []
    prev = None
    for s in spans:
        if prev is not None:
            gap = min(g.x0 for g in s) - max(g.x1 for g in prev)
            edge_a = prev[-1].text if not prev[-1].arabic else prev[-1].name
            edge_b = s[0].text if not s[0].arabic else s[0].name
            if gap > 0.16 * min(s[0].size, prev[-1].size) and edge_a not in (" ", "space") and edge_b not in (" ", "space"):
                sp = Glyph()
                sp.font, sp.size, sp.arabic, sp.text, sp.name = "gap", s[0].size, False, " ", None
                sp.x0 = sp.x1 = max(g.x1 for g in prev)
                units.append(([sp], "N"))
        prev = s
        if s[0].arabic:
            units.append((s, _span_class(s)))
        else:
            units.extend(_latin_units(s))
    classes = [c for _, c in units]
    n = len(units)

    def strong(i, step):
        j = i + step
        while 0 <= j < n:
            if classes[j] in ("L", "R"):
                return classes[j]
            if classes[j] == "AN":
                return "R"
            j += step
        return None

    # numbers: European digits next to Latin behave as Latin, otherwise as Arabic numbers
    for i, c in enumerate(classes):
        if c == "EN":
            l, r = strong(i, -1), strong(i, 1)
            if "L" in (l, r) and not (l == "R" and r == "R"):
                classes[i] = "L"
            elif l is None and r is None and not rtl:
                classes[i] = "L"
            else:
                classes[i] = "AN"
    levels = []
    for i, c in enumerate(classes):
        if c == "R":
            levels.append(1)
        elif c == "L":
            levels.append(2 if rtl else 0)
        elif c == "AN":
            levels.append(2)
        else:
            l, r = strong(i, -1), strong(i, 1)
            if l is None:
                l = "R" if rtl else "L"
            if r is None:
                r = "R" if rtl else "L"
            if l == r:
                levels.append(1 if l == "R" else (2 if rtl else 0))
            else:
                levels.append(1 if rtl else 0)
    # an LTR-paragraph Arabic group containing numbers: numbers are level 2 only inside it
    if not rtl:
        for i, c in enumerate(classes):
            if c == "AN":
                l, r = strong(i, -1), strong(i, 1)
                if "R" not in (l, r):
                    levels[i] = 0
    tokens = []
    for (gl, c), lv in zip(units, levels):
        for g in gl:
            tokens.append([lv, g])
    for threshold in (1, 2):
        i = 0
        while i < len(tokens):
            if tokens[i][0] >= threshold:
                j = i
                while j < len(tokens) and tokens[j][0] >= threshold:
                    j += 1
                tokens[i:j] = tokens[i:j][::-1]
                i = j
            else:
                i += 1
    out = []
    buf: list[str] = []
    for lv, g in tokens:
        if g.arabic:
            buf.append(g.name)
            continue
        if buf:
            out.append(decode_arabic(buf))
            buf = []
        t = g.text
        if lv % 2 == 1:
            t = t.translate(MIRROR)
        out.append(t)
    if buf:
        out.append(decode_arabic(buf))
    return "".join(out)
