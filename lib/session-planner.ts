export type StudyTask = {
  kind: "review" | "learn" | "practice";
  lessonId: string;
  chapter?: number;
  target?: {
    lessonId: string;
    groupId: string;
    questionId: string;
    key: string;
  };
};
export function tasksForLesson(
  doc: any,
  data: Record<string, any>,
  seen: Set<string>,
  limit = 8,
): StudyTask[] {
  const result: StudyTask[] = [],
    read = data["progress:" + doc.id]?.read || [];
  const chapter = doc.chapters.findIndex(
    (_: unknown, i: number) =>
      !read.includes(i) && !seen.has(`read:${doc.id}:${i}`),
  );
  if (chapter >= 0) result.push({ kind: "learn", lessonId: doc.id, chapter });
  for (const g of doc.exercises)
    for (const q of g.items) {
      const key = `answer:native:${doc.id}:${g.id}:${q.id}`;
      if (!data[key]?.rating && !seen.has(key) && result.length < limit)
        result.push({
          kind: "practice",
          lessonId: doc.id,
          target: { lessonId: doc.id, groupId: g.id, questionId: q.id, key },
        });
    }
  return result;
}
export const taskId = (t: StudyTask) =>
  t.target?.key || `read:${t.lessonId}:${t.chapter}`;
