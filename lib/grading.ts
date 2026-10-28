export type NormalizationPolicy =
  "choice-id" | "arabic-vocalized" | "arabic-unvocalized" | "text";
export type Gradable = {
  mode: string;
  answers?: string[];
  strictMarks?: boolean;
  normalization?: NormalizationPolicy;
};
/** Preserve hamza carriers, alif maqsura, ta marbuta and shadda unless explicitly
 * unvocalized. Punctuation is significant: alternatives belong in content. */
export function normalizeAnswer(
  value: string,
  policy: NormalizationPolicy,
): string {
  if (policy === "choice-id") return value.trim();
  let s = value
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u2066-\u2069\u0640]/g, "")
    .trim()
    .replace(/\s+/gu, " ");
  if (policy === "arabic-unvocalized")
    s = s.replace(/[\u064b-\u0652\u0670]/g, "");
  return policy === "text" ? s.toLocaleLowerCase("en") : s;
}
export function policyFor(q: Gradable): NormalizationPolicy {
  return (
    q.normalization ||
    (q.mode === "choice"
      ? "choice-id"
      : q.strictMarks
        ? "arabic-vocalized"
        : "text")
  );
}
export function evaluateAnswer(
  q: Gradable,
  text: string,
): "empty" | "model" | "good" | "again" {
  if (!text.trim()) return "empty";
  if (q.mode === "open" || !q.answers?.length) return "model";
  const policy = policyFor(q);
  return q.answers.some(
    (a) => normalizeAnswer(a, policy) === normalizeAnswer(text, policy),
  )
    ? "good"
    : "again";
}
export type Attempt = {
  at: string;
  text: string;
  rating: string;
  automatic: boolean;
};
export function withAttempt(
  previous: Record<string, any>,
  value: Record<string, any>,
) {
  const history: Attempt[] = [...(previous.history || [])];
  const event = {
    at: value.checkedAt,
    text: value.text || "",
    rating: value.rating,
    automatic: !!value.automatic,
  };
  if (history.at(-1)?.at === event.at) history[history.length - 1] = event;
  else history.push(event);
  return {
    ...previous,
    ...value,
    history: history.slice(-1000),
    firstAttempt: previous.firstAttempt || event,
  };
}
export function learningEvidence(
  progress: Record<string, any>,
  answers: Record<string, any>[],
  chapters: number,
  questions: number,
) {
  return {
    opened: !!progress.openedAt || !!progress.done || !!progress.read?.length,
    readingStarted: !!progress.read?.length,
    readingCompleted:
      chapters > 0 && new Set(progress.read || []).size >= chapters,
    exercisesAttempted: answers.filter((a) =>
      ["good", "again", "partial"].includes(a.rating),
    ).length,
    exercisesCompleted:
      questions > 0 &&
      answers.filter((a) => ["good", "again", "partial"].includes(a.rating))
        .length >= questions,
    legacyCompletion: !!progress.done && !progress.completionVersion,
    assessmentPassed: false,
    consolidated: false,
  };
}
