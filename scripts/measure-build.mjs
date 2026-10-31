import fs from "node:fs";
import { gzipSync } from "node:zlib";
const assets = fs.readdirSync("dist/assets").map((name) => {
  const bytes = fs.readFileSync("dist/assets/" + name);
  return { name, bytes: bytes.length, gzip: gzipSync(bytes).length };
});
const entry = fs.readFileSync("dist/index.html","utf8").match(/src="\.\/assets\/([^"]+\.js)"/)[1];
const main = assets.find((a) => a.name===entry),
  it = assets.find((a) => /^course-[^.]+\.js$/.test(a.name)),
  en = assets.find((a) => /^course\.en-/.test(a.name));
const report = {
  date: new Date().toISOString(),
  measurement:
    "Production artifact sizes, not field performance or Lighthouse scores",
  baseline: { initialJsBytes: 1125620, initialJsGzipBytes: 218850 },
  current: {
    main,
    italianIndex: it,
    englishIndex: en,
    initialItalianJsBytes: main.bytes + it.bytes,
    initialItalianJsGzipBytes: main.gzip + it.gzip,
  },
  assets,
};
fs.writeFileSync(
  "reports/performance.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report.current));
if (main.bytes + it.bytes > 450000)
  throw Error("Initial JS exceeds 450 kB budget");
