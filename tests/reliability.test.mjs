import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { load } from "./load-ts.mjs";
const storage = load("lib/storage.ts"),
  backup = load("lib/backup.ts"),
  grade = load("lib/grading.ts"),
  routing = load("lib/routing.ts"),
  clock = load("lib/study-clock.ts"),
  planner = load("lib/session-planner.ts");
test("v1 database upgrades without losing unknown records; atomic CAS prevents stale writers", async () => {
  const old = await new Promise((resolve, reject) => {
    const r = indexedDB.open("arabic-academy:./", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise((resolve) => {
    const tx = old.transaction("records", "readwrite");
    tx.objectStore("records").put({ done: true }, "progress:A0-L0-01");
    tx.objectStore("records").put({ x: [1] }, "legacy:unknown");
    tx.oncomplete = resolve;
  });
  old.close();
  const base = await storage.readSnapshot();
  assert.deepEqual(base.data["legacy:unknown"], { x: [1] });
  const first = await storage.commitRecords({ "note:a": "new" }, base);
  await assert.rejects(
    storage.commitRecords({ "note:a": "stale" }, base),
    storage.StorageConflict,
  );
  const second = await storage.commitRecords({ "note:b": "independent" }, base);
  assert.equal(second.data["note:a"], "new");
  assert.equal(second.data["note:b"], "independent");
  await assert.rejects(storage.commitRecords({ goal: 15 }, first, true));
  assert.equal((await storage.readSnapshot()).data["note:b"], "independent");
  const replaced = await storage.commitRecords(
    { goal: 20, "legacy:unknown": { x: [1] } },
    second,
    true,
  );
  assert.equal(replaced.data.goal, 20);
  assert.equal(replaced.data["note:a"], undefined);
});
test("backups v1 and v2 preserve unknown values, validate nested data and reject future formats", () => {
  const data = {
    "progress:A0-L0-01": { done: true, read: [0, 1] },
    "legacy:unknown": { value: [1, 2] },
    goal: 15,
  };
  assert.equal(
    backup.parseBackup(
      JSON.stringify({ format: "arabic-academy", version: 1, data }),
    ).unknown.length,
    1,
  );
  assert.deepEqual(
    backup.parseBackup(JSON.stringify(backup.makeBackup(data))).data,
    data,
  );
  for (const bad of [
    { format: "arabic-academy", version: 9, data },
    {
      format: "arabic-academy",
      version: 1,
      data: { "progress:a": { read: ["bad"] } },
    },
    { format: "arabic-academy", version: 2, schema: 9, data },
  ])
    assert.throws(() => backup.parseBackup(JSON.stringify(bad)));
  assert.throws(() =>
    backup.parseBackup(
      '{"format":"arabic-academy","version":1,"data":{"__proto__":{"x":1}}}',
    ),
  );
  assert.deepEqual(
    backup.backupConflicts(
      { "note:a": "old" },
      { "note:a": "new", "note:b": "b" },
    ),
    ["note:a"],
  );
});
test("normalization preserves meaningful Arabic distinctions and respects explicit policies", () => {
  const q = { mode: "input", answers: ["أَب"], strictMarks: true };
  assert.equal(grade.evaluateAnswer(q, "أَب"), "good");
  assert.equal(grade.evaluateAnswer(q, "اب"), "again");
  assert.equal(grade.evaluateAnswer(q, "أب"), "again");
  assert.equal(
    grade.evaluateAnswer({ ...q, normalization: "arabic-unvocalized" }, "أب"),
    "good",
  );
  assert.equal(
    grade.evaluateAnswer({ mode: "open", answers: ["x"] }, "x"),
    "model",
  );
  assert.equal(grade.evaluateAnswer(q, "  "), "empty");
  assert.equal(
    grade.evaluateAnswer({ mode: "input", answers: ["a", "b"] }, " b "),
    "good",
  );
  assert.notEqual(
    grade.normalizeAnswer("ى", "text"),
    grade.normalizeAnswer("ي", "text"),
  );
  assert.notEqual(
    grade.normalizeAnswer("ة", "text"),
    grade.normalizeAnswer("ه", "text"),
  );
  const first = grade.withAttempt(
    {},
    { text: "x", rating: "model", checkedAt: "2026-01-01", automatic: false },
  );
  const confirmed = grade.withAttempt(first, {
    text: "x",
    rating: "good",
    checkedAt: "2026-01-01",
    automatic: false,
  });
  assert.equal(confirmed.history.length, 1);
  assert.equal(confirmed.firstAttempt.rating, "model");
});
test("completion is never inferred as independent mastery", () => {
  const e = grade.learningEvidence({ done: true }, [], 10, 10);
  assert(e.legacyCompletion);
  assert.equal(e.assessmentPassed, false);
  assert.equal(e.consolidated, false);
});
test("routing survives encoded IDs and unknown routes", () => {
  assert.deepEqual(
    routing.parseRoute(routing.routeHash({ view: "lesson", id: "A0-L0-01" })),
    { view: "lesson", id: "A0-L0-01" },
  );
  assert.equal(routing.parseRoute("#/unknown").view, "missing");
  assert.equal(routing.parseRoute("#/lesson/%ZZ").view, "missing");
});
test("time excludes hidden, unfocused, idle and suspended periods", () => {
  assert.equal(clock.activeSeconds(10000, 9000, 9500, true, true), 1);
  assert.equal(clock.activeSeconds(10000, 9000, 9500, false, true), 0);
  assert.equal(clock.activeSeconds(10000, 9000, 9500, true, false), 0);
  assert.equal(clock.activeSeconds(100000, 9000, 0, true, true), 0);
  assert.equal(clock.activeSeconds(100000, 0, 99000, true, true), 5);
});
test("session extension avoids answered and already planned questions", () => {
  const doc = {
    id: "a",
    chapters: [{}],
    exercises: [{ id: "g", items: [{ id: "1" }, { id: "2" }] }],
  };
  const tasks = planner.tasksForLesson(
    doc,
    { "answer:native:a:g:1": { rating: "good" } },
    new Set(["read:a:0"]),
  );
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].target.questionId, "2");
});
test("bulk transaction abort cannot partially write records", async () => {
  const before = await storage.readSnapshot();
  await assert.rejects(
    storage.commitRecords(
      { "note:atomic": "must not persist", bad: () => {} },
      before,
    ),
  );
  assert.deepEqual((await storage.readSnapshot()).data, before.data);
});
test("SM-2-derived scheduling preserves legacy due dates until actual review", () => {
  const { nextReview } = load("lib/learning.ts");
  const legacy = { due: "2026-11-01", interval: 14, successes: 3 };
  const migrated = nextReview(legacy, "hard", new Date(2026, 10, 1, 12));
  assert.equal(migrated.history.length, 1);
  assert.equal(migrated.scheduler, "sm2-derived-v1");
  assert(migrated.ease < 2.5);
  assert.equal(legacy.due, "2026-11-01");
  assert.equal(
    nextReview(migrated, "again", new Date(2026, 10, 2, 12)).interval,
    0,
  );
});
test("vocabulary lookup does not invent roots; prerequisites use actual completion", () => {
  const v = load("lib/vocabulary.ts"),
    p = load("lib/prerequisites.ts");
  assert.equal(
    v.lookupWord([{ lemma: "بَاب", translation: "door" }], "باب").length,
    1,
  );
  assert.equal(v.lookupWord([{ lemma: "باب" }], "الباب").length, 0);
  assert.deepEqual(v.arabicTokens("Hello بَاب!"), ["بَاب"]);
  assert.deepEqual(p.missingPrerequisites(["first"], {}), ["first"]);
  assert.deepEqual(
    p.missingPrerequisites(["first"], {
      "micro:first": { completedAt: "today" },
    }),
    [],
  );
});
test("Arabic compatibility forms normalize without merging hamza carriers", () => {
  assert.equal(grade.normalizeAnswer("ﺏ", "text"), "ب");
  assert.notEqual(
    grade.normalizeAnswer("أ", "text"),
    grade.normalizeAnswer("ا", "text"),
  );
  assert.equal(grade.normalizeAnswer("ا\u0654", "text"), "أ");
});
test("all micro lessons have real source chapters, questions and acyclic prerequisites", async () => {
  const { readFileSync } = await import("node:fs");
  const modules = JSON.parse(readFileSync("data/micro-lessons.json"));
  const seen = new Set();
  for (const m of modules) {
    assert(m.prerequisites.every((p) => seen.has(p)));
    assert(!seen.has(m.id));
    seen.add(m.id);
    const d = JSON.parse(readFileSync(`public/course/${m.source}.json`));
    assert(d.chapters[m.chapter]?.blocks.length);
    assert(
      m.questions.every((id) =>
        d.exercises
          .find((g) => g.id === "starter")
          .items.some((q) => q.id === id),
      ),
    );
  }
});
