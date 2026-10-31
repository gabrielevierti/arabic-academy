import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const course = read("data/course.json");
test("Every indexed lesson and resource resolves to native content", () => {
  const ids = new Set();
  for (const lesson of course.lessons) {
    assert(!ids.has(lesson.id));
    ids.add(lesson.id);
    const native = read(`public/course/${lesson.id}.json`);
    assert(native.chapters.length > 0, lesson.id);
    assert.equal(
      native.exercises.length,
      lesson.exercises.length + (lesson.id === "A0-L0-01" ? 1 : 0),
      lesson.id,
    );
    for (const exercise of native.exercises) {
      assert(exercise.items.length > 0, `${lesson.id}/${exercise.id}`);
      for (const item of exercise.items)
        assert(
          ["choice", "input", "order", "open"].includes(item.mode),
          JSON.stringify(item),
        );
    }
  }
  for (const book of course.books)
    for (const r of book.resources || [])
      assert(read(`public/course/${r.id}.json`));
});
test("Static app has no account API calls or absolute course paths", () => {
  for (const file of ["app/page.tsx", "app/native-course.tsx"]) {
    const text = readFileSync(file, "utf8");
    assert(!text.includes("/api/records"));
    assert(!text.includes("fetch('/course/"));
  }
});
test("C1 volume is complete and C2 is no longer published", () => {
  assert(!course.books.some((b) => b.id === "C2"));
  assert(!course.lessons.some((l) => l.level === "C2"));
  const book = course.books.find((b) => b.id === "C1");
  assert(book, "C1 book");
  const lessons = course.lessons.filter((l) => l.level === "C1");
  assert.equal(lessons.length, 35);
  assert.deepEqual(
    [...new Set(lessons.map((l) => l.track))].sort(),
    ["C1", "EGY", "INT", "MAG"],
  );
  let questions = 0;
  for (const lesson of lessons) {
    const doc = read(`public/course/${lesson.id}.json`);
    const groups = new Set(doc.exercises.map((g) => g.id));
    // every in-lesson activity link opens an existing exercise group
    for (const chapter of doc.chapters)
      for (const block of chapter.blocks)
        if (block.type === "exercise") assert(groups.has(block.id), `${lesson.id}/${block.id}`);
    for (const g of doc.exercises) questions += g.items.length;
    assert.equal(lesson.nativeChapters, doc.chapters.length, lesson.id);
  }
  assert(questions > 1400, "C1 questions " + questions);
});
test("C1 Arabic text is decoded and directional isolates are balanced", () => {
  for (const r of course.books.find((b) => b.id === "C1").resources) {
    const text = readFileSync(`public/course/${r.id}.json`, "utf8");
    assert(!text.includes("�"), r.id);
    const opens = (text.match(/⁧/g) || []).length,
      closes = (text.match(/⁩/g) || []).length;
    assert.equal(opens, closes, r.id);
    // presentation forms or dotless skeletons mean a glyph was not recognised
    // (ornate Quranic parentheses ﴾﴿ and ﷺ are genuine characters)
    assert(
      !/[ﭐ-ﴽ﵀-ﷱﷳ-ﷹﹰ-ﻼٮٯڡں]/.test(text),
      r.id,
    );
  }
});
