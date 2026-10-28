import fs from "node:fs";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const findings = [],
  counts = { documents: 0, lessons: 0, questions: 0 };
function issue(severity, code, file, path, message) {
  findings.push({ severity, code, file, path, message });
}
function walk(x, f, p = "$") {
  if (typeof x === "string") f(x, p);
  else if (Array.isArray(x)) x.forEach((v, i) => walk(v, f, `${p}[${i}]`));
  else if (x && typeof x === "object")
    for (const [k, v] of Object.entries(x)) walk(v, f, `${p}.${k}`);
}
for (const lang of ["it", "en"]) {
  const root = `public/course/${lang === "en" ? "en/" : ""}`,
    index = read(`data/course${lang === "en" ? ".en" : ""}.json`),
    ids = new Set();
  for (const l of index.lessons) {
    if (ids.has(l.id))
      issue(
        "error",
        "duplicate-lesson",
        root,
        l.id,
        "Repeated lesson identifier",
      );
    ids.add(l.id);
    if (!["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(l.level))
      issue("error", "level", root, l.id, "Invalid level");
    if (!fs.existsSync(root + l.id + ".json"))
      issue("error", "reference", root, l.id, "Missing document");
  }
  for (const b of index.books)
    for (const r of b.resources || [])
      if (!fs.existsSync(root + r.id + ".json"))
        issue("error", "reference", root, r.id, "Missing resource");
  for (const file of fs
    .readdirSync(root)
    .filter((n) => n.endsWith(".json") && n !== "index.json")) {
    const filename = root + file,
      d = read(filename);
    counts.documents++;
    if (!d.title?.trim())
      issue("warning", "title", filename, "$.title", "Missing title");
    const blocks = (bs, path) => {
      if (!Array.isArray(bs) || !bs.length) {
        issue("warning", "empty-blocks", filename, path, "No blocks");
        return;
      }
      bs.forEach((b, i) => {
        if (b.type === "table") {
          if (!b.rows?.length || b.rows.some((r) => !Array.isArray(r)))
            issue("error", "table", filename, path + `[${i}]`, "Invalid table");
          else if (new Set(b.rows.map((r) => r.length)).size > 1)
            issue(
              "warning",
              "ragged-table",
              filename,
              path + `[${i}]`,
              "Unequal table row lengths; editorial review",
            );
        } else if (!b.text?.trim())
          issue(
            "warning",
            "empty-text",
            filename,
            path + `[${i}]`,
            "Empty block",
          );
      });
    };
    if (d.chapters) {
      counts.lessons++;
      if (!d.chapters.length)
        issue("error", "chapters", filename, "$.chapters", "Missing chapters");
      d.chapters.forEach((c, i) => blocks(c.blocks, `$.chapters[${i}].blocks`));
      if (!JSON.stringify(d.chapters).match(/prerequisit|prerequisite/i))
        issue(
          "warning",
          "prerequisites",
          filename,
          "$.chapters",
          "No explicit prerequisite text found",
        );
      const signatures = new Map();
      const gids = new Set();
      for (const [gi, g] of (d.exercises || []).entries()) {
        const gp = `$.exercises[${gi}]`;
        if (gids.has(g.id))
          issue("error", "duplicate-group", filename, gp, g.id);
        gids.add(g.id);
        const qids = new Set();
        for (const [qi, q] of (g.items || []).entries()) {
          counts.questions++;
          const qp = gp + `.items[${qi}]`;
          if (qids.has(q.id))
            issue("error", "duplicate-question", filename, qp, q.id);
          qids.add(q.id);
          if (q.prompt?.trim()) {
            const signature = JSON.stringify([
              q.mode,
              q.prompt,
              q.answers,
              q.model,
            ]);
            if (signatures.has(signature))
              issue(
                "warning",
                "duplicate-content",
                filename,
                qp,
                "Same prompt/solution as " + signatures.get(signature),
              );
            else signatures.set(signature, qp);
          }
          if (!q.prompt?.trim())
            issue(
              "warning",
              "empty-prompt",
              filename,
              qp,
              "Prompt missing; group instructions may supply context",
            );
          if (!q.explanation?.trim())
            issue(
              "warning",
              "explanation",
              filename,
              qp,
              "No individual explanation",
            );
          if (q.mode === "open" && !q.model?.trim())
            issue(
              "warning",
              "model",
              filename,
              qp,
              "No individual answer model; inspect solutionBlocks",
            );
          if (
            q.mode !== "open" &&
            (!q.answers?.length ||
              q.answers.some((a) => typeof a !== "string" || !a.trim()))
          )
            issue(
              "error",
              "answers",
              filename,
              qp,
              "Automatic exercise has no valid answers",
            );
          if (
            q.mode === "choice" &&
            (!q.options?.length ||
              q.answers?.some((a) => !q.options.some((o) => o.id === a)))
          )
            issue("error", "choice", filename, qp, "Invalid choice reference");
          if (q.mode === "order" && !q.tokens?.length)
            issue("error", "tokens", filename, qp, "Missing ordering tokens");
        }
      }
    } else if (d.blocks) blocks(d.blocks, "$.blocks");
    walk(d, (s, p) => {
      let balance = 0;
      for (const ch of s) {
        if (/[\u2066-\u2068]/.test(ch)) balance++;
        if (ch === "\u2069") balance--;
        if (balance < 0) break;
      }
      if (balance !== 0)
        issue(
          "warning",
          "bidi",
          filename,
          p,
          "Unbalanced directional isolation",
        );
      if (
        lang === "en" &&
        /mandatory italian|obligatory italic|mandatory cursive|\bdente\b|\bdeclination\b/i.test(
          s,
        )
      )
        issue("warning", "terminology", filename, p, s.slice(0, 220));
      if (/\ufffd/.test(s))
        issue("error", "unicode", filename, p, "Replacement character");
    });
    if (lang === "it") {
      const enPath = `public/course/en/${file}`;
      if (!fs.existsSync(enPath))
        issue(
          "error",
          "translation-missing",
          filename,
          "$",
          "No English document",
        );
    }
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  status:
    "Structural checks do not establish linguistic correctness or human review.",
  counts,
  errors: findings.filter((x) => x.severity === "error").length,
  warnings: findings.filter((x) => x.severity === "warning").length,
  findings,
};
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(
  "reports/content-qa.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ ...report, findings: undefined }));
if (report.errors) process.exitCode = 1;
