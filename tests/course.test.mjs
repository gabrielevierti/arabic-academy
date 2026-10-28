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
