// One-off content repairs for volumes A0–B2, applied to the Italian documents
// and, at the same positions, to the archived English documents so both keep the
// same structure. Safe to run more than once.
// 1. The original conversion split long list items at the PDF line break, leaving
//    the end of the item as a separate paragraph («… e ne» + «distingui fatti…»).
// 2. Right-to-left table cells were read in visual order: a dialogue line came out
//    as «first line : speaker other lines». They are rebuilt in reading order as one
//    Arabic isolate («speaker: first line other lines»).
import fs from "node:fs";

const END = /[.;:!?»)…]\s*$/;
const CONTINUES = /^[a-zàèéìòù(«]/;
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
let merged = 0,
  cells = 0;
const ISO = "\u2067[^\u2066-\u2069]*\u2069";
const VISUAL_CELL = new RegExp(`^(${ISO}) : (${ISO})((?: ${ISO})*)$`);
const inner = (s) => s.slice(1, -1).trim();
function readingOrder(cell) {
  const m = VISUAL_CELL.exec(cell);
  if (!m) return cell;
  const speaker = inner(m[2]);
  if (speaker.split(/\s+/).length > 3) return cell;
  const rest = (m[3].match(new RegExp(ISO, "g")) || []).map(inner);
  return "\u2067" + [speaker + ":", inner(m[1]), ...rest].join(" ") + "\u2069";
}
function repairTable(it, en) {
  if (it?.type !== "table" || !Array.isArray(it.rows)) return;
  it.rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      const fixed = readingOrder(cell);
      if (fixed === cell) return;
      if (en && en.rows?.[r]?.[c] === cell) en.rows[r][c] = fixed;
      row[c] = fixed;
      cells++;
    }),
  );
}

function repair(it, en) {
  if (!Array.isArray(it)) return;
  it.forEach((b, i) => repairTable(b, en?.[i]));
  for (let i = 0; i < it.length - 1; ) {
    const a = it[i],
      b = it[i + 1];
    const parallel =
      !en || (en[i]?.type === a.type && en[i + 1]?.type === b.type);
    if (
      a?.type === "list" &&
      b?.type === "paragraph" &&
      !END.test(a.text) &&
      CONTINUES.test(b.text.trimStart()) &&
      parallel
    ) {
      a.text = a.text.trimEnd() + " " + b.text.trimStart();
      it.splice(i + 1, 1);
      if (en) {
        en[i].text = en[i].text.trimEnd() + " " + en[i + 1].text.trimStart();
        en.splice(i + 1, 1);
      }
      merged++;
      continue;
    }
    i++;
  }
}

function walk(it, en) {
  repair(it.blocks, en?.blocks);
  for (const [k, ch] of (it.chapters || []).entries())
    repair(ch.blocks, en?.chapters?.[k]?.blocks);
  for (const [k, g] of (it.exercises || []).entries())
    repair(g.blocks, en?.exercises?.[k]?.blocks);
  repair(it.solutionBlocks, en?.solutionBlocks);
}

for (const name of fs.readdirSync("public/course")) {
  if (!/^(A0|A1|A2|B1|B2)-.*\.json$/.test(name)) continue;
  const itPath = "public/course/" + name,
    enPath = "public/course/en/" + name;
  const it = read(itPath),
    en = fs.existsSync(enPath) ? read(enPath) : null;
  const before = merged + cells;
  walk(it, en);
  if (merged + cells === before) continue;
  fs.writeFileSync(itPath, JSON.stringify(it));
  if (en) fs.writeFileSync(enPath, JSON.stringify(en));
}
console.log("Merged list continuations:", merged, "· dialogue cells reordered:", cells);
