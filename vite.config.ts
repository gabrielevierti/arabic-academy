import { defineConfig, type Plugin } from "vite";

/** The app reads only a few fields of the course index; page ranges, outline
 * sections and exercise lists stay in data/course.json for tooling and tests
 * but are not shipped in the initial bundle. */
function slimCourseIndex(): Plugin {
  const lessonKeys = ["id", "code", "level", "title", "track", "nativeChapters", "nativeItems"];
  return {
    name: "slim-course-index",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]data[\\/]course(\.en)?\.json$/.test(id)) return null;
      const course = JSON.parse(code);
      const slim = {
        books: course.books.map((b: any) => ({
          id: b.id,
          title: b.title,
          resources: (b.resources || []).map((r: any) => ({ id: r.id, title: r.title })),
        })),
        lessons: course.lessons.map((l: any) =>
          Object.fromEntries(lessonKeys.filter((k) => k in l).map((k) => [k, l[k]])),
        ),
      };
      return { code: JSON.stringify(slim), map: null };
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [slimCourseIndex()],
  build: { emptyOutDir: true },
  server: { allowedHosts: ["terminal.local"] },
});
