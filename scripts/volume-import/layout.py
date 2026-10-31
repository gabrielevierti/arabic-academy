"""Page layout analysis: pieces -> table cells and flow lines."""
from __future__ import annotations
from dataclasses import dataclass, field
import re
import pymupdf
from pdftext import FontBook, Glyph, page_glyphs, logical_line, _is_mark, ARABIC, LATIN

HEADER_FILL = (0.12, 0.23, 0.37)
ZEBRA_FILL = (0.96, 0.97, 0.98)
BORDER_COLORS = {(0.84, 0.85, 0.88), (0.89, 0.91, 0.93)}


@dataclass
class Piece:
    glyphs: list
    y: float
    x0: float
    x1: float
    top: float
    bottom: float
    font: str
    size: float
    bold: bool
    italic: bool
    color: tuple
    arabic: bool
    marks_only: bool = False

    @property
    def cx(self):
        return (self.x0 + self.x1) / 2


@dataclass
class Line:
    pieces: list
    y: float
    x0: float
    x1: float
    top: float
    bottom: float
    page: int
    text: str = ""
    rtl: bool = False

    @property
    def size(self):
        # dominant Latin size, else Arabic
        lat = [p for p in self.pieces if not p.arabic and p.glyphs]
        src = lat or self.pieces
        return max(src, key=lambda p: len(p.glyphs)).size

    @property
    def fonts(self):
        return {p.font for p in self.pieces}

    def style(self):
        lat = [p for p in self.pieces if not p.arabic and any((g.text or "").strip() for g in p.glyphs)]
        if not lat:
            p = max(self.pieces, key=lambda p: len(p.glyphs))
            return (p.font, round(p.size, 1), p.color)
        p = max(lat, key=lambda p: sum(1 for g in p.glyphs if (g.text or "").strip()))
        return (p.font, round(p.size, 1), p.color)

    @property
    def arabic_count(self):
        return sum(1 for p in self.pieces if p.arabic for g in p.glyphs if not _is_mark(g.name) and g.name != "space")

    @property
    def latin_count(self):
        return sum(1 for p in self.pieces if not p.arabic for g in p.glyphs if LATIN.match(g.text or ""))


@dataclass
class Cell:
    x0: float
    y0: float
    x1: float
    y1: float
    header: bool = False
    lines: list = field(default_factory=list)


@dataclass
class Table:
    rows: list  # list of list[Cell]
    top: float
    bottom: float
    x0: float
    x1: float
    page: int


def _mk_piece(glyphs: list[Glyph]) -> Piece:
    bases = [g for g in glyphs if not (g.arabic and _is_mark(g.name))] or glyphs
    y = max(set(round(g.y, 1) for g in bases), key=lambda v: sum(1 for g in bases if round(g.y, 1) == v))
    g0 = glyphs[0]
    return Piece(glyphs=glyphs, y=y, x0=min(g.x0 for g in glyphs), x1=max(g.x1 for g in glyphs),
                 top=min(g.top for g in bases), bottom=max(g.bottom for g in bases), font=g0.font,
                 size=g0.size, bold=g0.bold, italic=g0.italic, color=g0.color, arabic=g0.arabic,
                 marks_only=all(g.arabic and _is_mark(g.name) for g in glyphs))


DIGIT = re.compile(r"^uni(066[0-9]|06F[0-9]|066B|066C)")


def _digit(g: Glyph) -> bool:
    return bool(g.arabic and g.name and DIGIT.match(g.name))


NUM_SEP = {"period", "uni002E", "colon", "uni003A", "comma", "uni002C", "uni060C", "slash", "uni002F"}


def split_span(glyphs: list[Glyph]) -> list[Piece]:
    pieces, cur, pending = [], [], []
    last = None
    # a single separator between Arabic-Indic digits belongs to the number (UBA rule W4)
    bases = [g for g in glyphs if not (g.arabic and _is_mark(g.name))]
    numeric = {}
    for i, g in enumerate(bases):
        d = _digit(g)
        if not d and g.arabic and g.name in NUM_SEP and 0 < i < len(bases) - 1:
            d = _digit(bases[i - 1]) and _digit(bases[i + 1])
        numeric[id(g)] = d
    for g in glyphs:
        if g.arabic and _is_mark(g.name):
            pending.append(g)
            continue
        if last is not None and (abs(g.y - last.y) > 0.45 * g.size or g.x0 < last.x0 - 1.0
                                 or g.x0 - last.x1 > 0.6 * g.size
                                 or numeric[id(g)] != numeric[id(last)]):
            pieces.append(cur)
            cur = []
        cur.extend(pending)
        pending = []
        cur.append(g)
        last = g
    if pending:
        if cur and abs(pending[0].x0 - cur[-1].x0) < 3 * pending[0].size and abs(pending[0].y - cur[-1].y) < pending[0].size:
            cur.extend(pending)
        else:
            if cur:
                pieces.append(cur)
            cur = pending
    if cur:
        pieces.append(cur)
    return [_mk_piece(p) for p in pieces if p]


def is_running_header(p: Piece, page_height: float) -> bool:
    if p.top < 36 and p.size < 8:
        return True
    if p.bottom > page_height - 30 and p.size <= 8.1 and not p.arabic:
        return True
    return False


# --------------------------------------------------------------------------- tables

def _close(a, b, tol=0.6):
    return abs(a - b) <= tol


def find_tables(page: pymupdf.Page, pieces: list[Piece], pno: int) -> list[Table]:
    fills, lines = [], []
    for d in page.get_drawings():
        r = d["rect"]
        kinds = "".join(it[0] for it in d["items"])
        fill = tuple(round(x, 2) for x in (d.get("fill") or ()))
        color = tuple(round(x, 2) for x in (d.get("color") or ()))
        if d["type"] == "f" and kinds == "re" and fill in (HEADER_FILL, ZEBRA_FILL):
            if r.width > 590 and r.height > 800:
                continue
            fills.append((r.x0, r.y0, r.x1, r.y1, fill == HEADER_FILL))
        elif d["type"] == "s" and color in BORDER_COLORS and r.height < 1.5:
            lines.append((r.x0, r.y0, r.x1))
    if not fills and not lines:
        return []
    cells = {}
    for x0, y0, x1, y1, hdr in fills:
        cells[(round(x0, 1), round(x1, 1), round(y1, 1))] = Cell(x0, y0, x1, y1, hdr)
    # boundaries usable as tops
    tops = [(y1, x0, x1) for x0, y0, x1, y1, h in fills] + [(y0, x0, x1) for x0, y0, x1, y1, h in fills] + \
           [(y, x0, x1) for x0, y, x1 in lines]
    # text lines (flow candidates) for crossing tests
    # bottom borders grouped by row (same y)
    by_y = {}
    for x0, y, x1 in lines:
        if any(_close(c.x0, x0) and _close(c.x1, x1) and _close(c.y1, y, 1.0) for c in cells.values()):
            continue
        by_y.setdefault(round(y, 1), []).append((x0, y, x1))
    for yk in sorted(by_y):
        segs = by_y[yk]
        y = segs[0][1]
        rx0, rx1 = min(s[0] for s in segs), max(s[2] for s in segs)
        cand = [t for t in tops if t[0] < y - 1.0 and min(t[2], rx1) - max(t[1], rx0) > 2]
        top = max((t[0] for t in cand), default=None)
        if top is not None:
            between = [p for p in pieces if p.top > top + 0.5 and p.bottom < y - 0.5 and not p.marks_only
                       and p.x1 > rx0 and p.x0 < rx1]
            bounds = sorted({s[0] for s in segs} | {s[2] for s in segs})
            inner = bounds[1:-1]
            if any(p.x0 < rx0 - 2 or p.x1 > rx1 + 2 or any(p.x0 < b - 2 and p.x1 > b + 2 for b in inner) for p in between):
                top = None
            elif y - top > 260 and not between:
                top = None
        if top is None:
            topmost = None
            for x0, _, x1 in segs:
                inside = [p for p in pieces if p.bottom < y - 0.5 and p.x0 >= x0 - 1 and p.x1 <= x1 + 1 and not p.marks_only
                          and p.bottom > y - 400]
                inside.sort(key=lambda p: -p.bottom)
                if not inside:
                    continue
                first = inside[0]
                if y - first.bottom > 40:
                    continue
                tm = first.top
                for p in inside[1:]:
                    if tm - p.bottom > 6.5:
                        break
                    tm = min(tm, p.top)
                topmost = tm if topmost is None else min(topmost, tm)
            if topmost is None:
                continue
            top = topmost - 4.5
        for x0, _, x1 in segs:
            cells[(round(x0, 1), round(x1, 1), round(y, 1))] = Cell(x0, top, x1, y, False)
    # rows: group cells by (top,bottom)
    allcells = sorted(cells.values(), key=lambda c: (round(c.y1), c.x0))
    rows = []
    for c in allcells:
        for r in rows:
            if _close(r[0].y1, c.y1, 1.5) and (_close(r[0].y0, c.y0, 6) or c.header == r[0].header):
                r.append(c)
                break
        else:
            rows.append([c])
    for r in rows:
        r.sort(key=lambda c: c.x0)
        top = min(c.y0 for c in r)
        for c in r:
            c.y0 = top
    rows.sort(key=lambda r: r[0].y0)
    tables, cur = [], []
    for r in rows:
        if cur and (r[0].y0 - cur[-1][0].y1 > 3.0 or r[0].header and not cur[-1][0].header):
            tables.append(cur)
            cur = []
        cur.append(r)
    if cur:
        tables.append(cur)
    out = []
    for t in tables:
        out.append(Table(rows=t, top=t[0][0].y0, bottom=t[-1][0].y1, x0=min(c.x0 for r in t for c in r),
                         x1=max(c.x1 for r in t for c in r), page=pno))
    return out


# --------------------------------------------------------------------------- lines

def group_lines(pieces: list[Piece], pno: int) -> list[Line]:
    bases = [p for p in pieces if not p.marks_only]
    marks = [p for p in pieces if p.marks_only]
    bases.sort(key=lambda p: (p.y, p.x0))
    lines: list[Line] = []
    for p in bases:
        for ln in lines[-4:]:
            if abs(ln.y - p.y) <= 1.6:
                ln.pieces.append(p)
                ln.x0, ln.x1 = min(ln.x0, p.x0), max(ln.x1, p.x1)
                ln.top, ln.bottom = min(ln.top, p.top), max(ln.bottom, p.bottom)
                break
        else:
            lines.append(Line([p], p.y, p.x0, p.x1, p.top, p.bottom, pno))
    # attach stray marks to the closest Arabic piece horizontally overlapping
    for m in marks:
        best, bd = None, 1e9
        for ln in lines:
            for p in ln.pieces:
                if not p.arabic:
                    continue
                if p.x0 - 2 <= m.cx <= p.x1 + 2:
                    d = abs(p.y - m.y)
                    if d < bd:
                        best, bd = p, d
        if best is not None and bd < 2 * m.size:
            # insert before the base glyph that horizontally contains the mark
            gl = best.glyphs
            idx = None
            for i, g in enumerate(gl):
                if not _is_mark(g.name) and g.x0 - 0.5 <= m.cx <= g.x1 + 0.5:
                    idx = i
                    break
            if idx is None:
                idx = min(range(len(gl)), key=lambda i: abs(gl[i].x0 - m.cx))
            # marks precede their base in visual order; skip back over other marks of the base
            while idx > 0 and _is_mark(gl[idx - 1].name):
                idx -= 1
            best.glyphs = gl[:idx] + m.glyphs + gl[idx:]
    lines.sort(key=lambda l: (l.y, l.x0))
    return lines


def line_direction(line: Line, left: float, right: float) -> bool | None:
    dl, dr = line.x0 - left, right - line.x1
    if dl < 4 and dr < 4:
        return None
    if dr + 12 < dl:
        return True
    if dl + 12 < dr:
        return False
    return None


def set_text(lines: list[Line], rtl: bool):
    for ln in lines:
        ln.rtl = rtl
        ln.text = logical_line([p.glyphs for p in ln.pieces], rtl)


def analyze(page: pymupdf.Page, book: FontBook, pno: int):
    spans = page_glyphs(page, book)
    pieces = [pc for s in spans for pc in split_span(s)]
    h = page.rect.height
    pieces = [p for p in pieces if not is_running_header(p, h)]
    tables = find_tables(page, pieces, pno)
    if tables:
        cut = []
        for p in pieces:
            bounds = sorted({b for t in tables if t.top - 1 <= (p.top + p.bottom) / 2 <= t.bottom + 1
                             for r in t.rows for c in r for b in (c.x0, c.x1)
                             if c.y0 - 1 <= (p.top + p.bottom) / 2 <= c.y1 + 1})
            inner = [b for b in bounds if p.x0 + 1 < b < p.x1 - 1]
            if not inner:
                cut.append(p)
                continue
            groups = [[] for _ in range(len(inner) + 1)]
            for g in p.glyphs:
                cx = (g.x0 + g.x1) / 2
                groups[sum(1 for b in inner if cx > b)].append(g)
            cut.extend(_mk_piece(gr) for gr in groups if gr)
        pieces = cut
    flow = []
    for p in pieces:
        cy = (p.top + p.bottom) / 2 if not p.marks_only else p.y
        target = None
        for t in tables:
            if t.top - 1 <= cy <= t.bottom + 1 and t.x0 - 1 <= p.cx <= t.x1 + 1:
                for r in t.rows:
                    for c in r:
                        if c.y0 - 1 <= cy <= c.y1 + 1 and c.x0 - 0.5 <= p.cx <= c.x1 + 0.5:
                            target = c
                            break
                    if target:
                        break
                if target:
                    break
        if target is not None:
            target.lines.append(p)
        else:
            flow.append(p)
    for t in tables:
        for r in t.rows:
            for c in r:
                ls = group_lines(c.lines, pno)
                c.lines = ls
    flow_lines = group_lines(flow, pno)
    return flow_lines, tables
