export type Records = Record<string, any>;
export type Target = {
  lessonId: string;
  groupId: string;
  questionId: string;
  key: string;
};
export const localDay = (date = new Date()) => date.toLocaleDateString("sv-SE");
export function parseAnswerKey(key: string): Target | null {
  const p = key.split(":");
  return p.length === 5 && p[0] === "answer" && p[1] === "native"
    ? { lessonId: p[2], groupId: p[3], questionId: p[4], key }
    : null;
}
/** SM-2-derived scheduler: Again=1, Hard=3, Good=4, Easy=5.
 * Legacy state is retained; ease starts at 2.5 only when first reviewed here.
 * No historic review events or memory stability are reconstructed. */
export function nextReview(previous: any, rating: string, date = new Date()) {
  if (
    rating !== "again" &&
    previous?.lastRating !== "again" &&
    previous?.reviewedAt &&
    localDay(new Date(previous.reviewedAt)) === localDay(date)
  )
    return previous;
  const q =
    ({ again: 1, hard: 3, good: 4, easy: 5 } as Record<string, number>)[
      rating
    ] ?? 1;
  const oldEase = previous?.ease ?? 2.5,
    successes = q >= 3 ? (previous?.successes || 0) + 1 : 0;
  const days =
    q < 3
      ? 0
      : successes === 1
        ? 1
        : successes === 2
          ? 6
          : Math.min(3650, Math.ceil((previous?.interval || 1) * oldEase));
  const ease =
    q < 3
      ? oldEase
      : Math.max(1.3, oldEase + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const due = new Date(date);
  due.setDate(due.getDate() + days);
  return {
    ...previous,
    scheduler: "sm2-derived-v1",
    due: localDay(due),
    successes,
    interval: days,
    ease,
    lastRating: rating,
    reviewedAt: date.toISOString(),
    history: [
      ...(previous?.history || []),
      { at: date.toISOString(), rating, interval: days },
    ].slice(-1000),
  };
}
export function errorQueue(
  data: Records,
  today = localDay(),
  dueOnly = true,
): Target[] {
  return Object.entries(data)
    .flatMap(([key, value]) => {
      const target = parseAnswerKey(key);
      if (!target) return [];
      const review = data["review:" + key];
      const pending = review
        ? !dueOnly || review.due <= today
        : ["again", "partial"].includes(value?.rating);
      return pending
        ? [
            {
              ...target,
              due: review?.due || "0000",
              checkedAt: value?.checkedAt || "",
            },
          ]
        : [];
    })
    .sort(
      (a: any, b: any) =>
        a.due.localeCompare(b.due) || a.checkedAt.localeCompare(b.checkedAt),
    );
}
export function streak(data: Records, date = new Date()) {
  const d = new Date(date);
  if (!data["activity:" + localDay(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (n < 10000 && data["activity:" + localDay(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export function levelMetrics(
  lessons: any[],
  meta: Records,
  data: Records,
  level: string,
) {
  const core = lessons.filter((l) => l.level === level && meta[l.id]?.core);
  let low = 0,
    high = 0,
    read = 0,
    answered = 0,
    correct = 0,
    chapters = 0,
    questions = 0;
  const answers = Object.entries(data).filter(([k]) =>
    k.startsWith("answer:native:"),
  );
  for (const l of core) {
    const m = meta[l.id],
      p = data["progress:" + l.id] || {};
    const r = new Set(
      (p.read || []).filter(
        (i: any) => Number.isInteger(i) && i >= 0 && i < m.chapters,
      ),
    ).size;
    const a = answers.filter(
      ([k, v]) =>
        k.startsWith("answer:native:" + l.id + ":") &&
        ["good", "again", "partial"].includes(v?.rating),
    );
    const good = a.filter(([, v]) => v.rating === "good").length;
    read += r;
    answered += a.length;
    correct += good;
    chapters += m.chapters;
    questions += m.questions;
    const fraction = p.done
      ? 1
      : Math.min(
          1,
          (0.5 * r) / Math.max(1, m.chapters) +
            (0.5 * good) / Math.max(1, m.questions),
        );
    low += (m.hours?.[0] || 0) * (1 - fraction);
    high += (m.hours?.[1] || 0) * (1 - fraction);
  }
  return {
    total: core.length,
    done: core.filter((l) => data["progress:" + l.id]?.done).length,
    read,
    answered,
    correct,
    chapters,
    questions,
    low: Math.ceil(low),
    high: Math.ceil(high),
  };
}
