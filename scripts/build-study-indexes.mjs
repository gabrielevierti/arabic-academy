import fs from "node:fs";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8")),
  index = read("data/course.json");
function strings(x) {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(strings).join(" ");
  if (x && typeof x === "object")
    return Object.entries(x)
      .filter(([k]) =>
        ["title", "text", "rows", "blocks", "chapters"].includes(k),
      )
      .map(([, v]) => strings(v))
      .join(" ");
  return "";
}
function tables(x, result = []) {
  if (x?.type === "table") result.push(x);
  if (Array.isArray(x)) x.forEach((v) => tables(v, result));
  else if (x && typeof x === "object")
    Object.values(x).forEach((v) => tables(v, result));
  return result;
}
const clean = (s) => s.replace(/[\u2066-\u2069★]/g, "").trim();
for (const language of ["it", "en"]) {
  const dir = `public/study/${language}`;
  fs.mkdirSync(dir, { recursive: true });
  const translated = read(`data/course${language === "en" ? ".en" : ""}.json`);
  // English is an archive of A0–B2; C1 is published in Italian only.
  const levels = ["A0", "A1", "A2", "B1", "B2", ...(language === "it" ? ["C1"] : [])];
  for (const level of levels) {
    const vocab = [],
      search = [],
      seen = new Set();
    for (const lesson of index.lessons.filter((l) => l.level === level)) {
      const source = read(`public/course/${lesson.id}.json`),
        doc = read(
          `public/course/${language === "en" ? "en/" : ""}${lesson.id}.json`,
        );
      search.push({
        id: lesson.id,
        title: doc.title,
        level,
        text: strings(doc.chapters),
      });
      const src = tables(source.chapters),
        dst = tables(doc.chapters);
      src.forEach((table, ti) => {
        const headers = table.rows[0].map((x) => x.toLowerCase().trim());
        const a = headers.indexOf("arabo"),
          m = headers.findIndex((h) => h === "significato"),
          tr = headers.findIndex((h) => h.startsWith("traslitt"));
        if (a < 0 || m < 0) return;
        table.rows.slice(1).forEach((row, ri) => {
          const lemma = clean(row[a] || "");
          if (!/\p{Script=Arabic}/u.test(lemma) || lemma.length > 80 || !row[m])
            return;
          const id = lesson.id + ":" + ti + ":" + ri;
          const dedupe = lemma + "|" + row[m];
          if (seen.has(dedupe)) return;
          seen.add(dedupe);
          vocab.push({
            id,
            lemma,
            translation: clean(dst[ti]?.rows[ri + 1]?.[m] || row[m]),
            transliteration: tr >= 0 ? row[tr] : "",
            root: headers.includes("radice") ? clean(row[headers.indexOf("radice")] || "") : undefined,
            source: lesson.id,
            level,
            provenance: "course-table; not independently reviewed",
          });
        });
      });
    }
    fs.writeFileSync(`${dir}/${level}-vocabulary.json`, JSON.stringify(vocab));
    fs.writeFileSync(`${dir}/${level}-search.json`, JSON.stringify(search));
    console.log(language, level, vocab.length, "vocabulary entries");
  }
}
