import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
function load(path) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const m = { exports: {} };
  new Function("exports", "module", code)(m.exports, m);
  return m.exports;
}
const { parseAnswerKey, nextReview, errorQueue, streak, levelMetrics } =
  load("lib/learning.ts");
const { validRecord } = load("lib/study-data.ts");
const key = "answer:native:A0-L0-01:warmup:q1";
test("Mistake queue restores legacy errors and keeps scheduled answers after correction", () => {
  const d = {
    [key]: { rating: "again" },
    "answer:quiz:x": { rating: "again" },
  };
  assert.equal(errorQueue(d, "2026-10-27").length, 1);
  assert.equal(parseAnswerKey(key).lessonId, "A0-L0-01");
  const first = nextReview(null, "good", new Date(2026, 9, 27, 12));
  assert.equal(first.due, "2026-10-28");
  assert.equal(first.interval, 1);
  d[key] = { rating: "good" };
  d["review:" + key] = first;
  assert.equal(errorQueue(d, "2026-10-27").length, 0);
  assert.equal(errorQueue(d, "2026-10-28").length, 1);
  assert.equal(errorQueue(d, "2026-10-27", false).length, 1);
  const second = nextReview(first, "good", new Date(2026, 9, 28, 12));
  assert.equal(second.interval, 6);
  assert.equal(second.due, "2026-11-03");
  const failed = nextReview(second, "again", new Date(2026, 9, 31, 12));
  assert.equal(failed.successes, 0);
  assert.equal(failed.due, "2026-10-31");
});
test("Streak tolerates today not yet studied and crosses month boundaries", () => {
  assert.equal(
    streak(
      { "activity:2026-10-31": true, "activity:2026-10-30": true },
      new Date(2026, 10, 1, 12),
    ),
    2,
  );
  assert.equal(
    streak({ "activity:2026-10-29": true }, new Date(2026, 10, 1, 12)),
    0,
  );
});
test("Level estimates exclude supplements and use reading plus correct answers", () => {
  const lessons = [
      { id: "a", level: "A0" },
      { id: "extra", level: "A0" },
    ],
    meta = {
      a: { core: true, chapters: 2, questions: 2, hours: [10, 12] },
      extra: { core: false, chapters: 1, questions: 1, hours: [20, 30] },
    };
  let m = levelMetrics(lessons, meta, {}, "A0");
  assert.equal(m.low, 10);
  assert.equal(m.total, 1);
  m = levelMetrics(
    lessons,
    meta,
    {
      "progress:a": { read: [0, 0, 99] },
      "answer:native:a:g:q": { rating: "good" },
    },
    "A0",
  );
  assert.equal(m.low, 5);
  assert.equal(m.high, 6);
  assert.equal(m.read, 1);
  m = levelMetrics(lessons, meta, { "progress:a": { done: true } }, "A0");
  assert.equal(m.high, 0);
  assert.equal(m.done, 1);
  assert.equal(levelMetrics(lessons, meta, {}, "C1").total, 0);
});
test("New study records round-trip through backup validation", () => {
  assert(validRecord("goal", 15));
  assert(validRecord("review:" + key, nextReview(null, "again")));
  assert(validRecord("study:2026-10-27", { seconds: 345 }));
  assert(
    validRecord("alphabet:ب", { known: true, lastCorrect: false, attempts: 3 }),
  );
  assert(
    validRecord("session:one", {
      date: "2026-10-27",
      seconds: 123,
      answers: 3,
      good: 2,
      read: 1,
      kind: "guided",
    }),
  );
  assert(!validRecord("study:2026-10-27", { seconds: -1 }));
  assert(!validRecord("alphabet:bad", { known: true }));
  assert(
    !validRecord("review:" + key, {
      due: "x",
      successes: 0,
      interval: 0,
      lastRating: "again",
    }),
  );
});
test("Every core lesson has a source duration and positive content counts", () => {
  const meta = JSON.parse(readFileSync("data/study-metadata.json"));
  assert.equal(Object.keys(meta).length, 135);
  for (const value of Object.values(meta)) {
    assert(value.hours[0] > 0);
    assert(value.hours[1] >= value.hours[0]);
    assert(value.chapters > 0);
  }
});
test("Retrying a correct answer on the same day does not inflate review spacing", () => {
  const first = nextReview(null, "good", new Date(2026, 9, 27, 9));
  assert.deepEqual(nextReview(first, "good", new Date(2026, 9, 27, 10)), first);
});
