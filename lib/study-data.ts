export function validRecord(key: string, v: any): boolean {
  const str = (s: any, max = 50000) => typeof s === "string" && s.length <= max;
  const obj = () => v !== null && typeof v === "object" && !Array.isArray(v);
  const date = (s: any) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  const integer = (n: any, max = 100000000) =>
    Number.isInteger(n) && n >= 0 && n <= max;
  if (key.startsWith("review:answer:native:"))
    return (
      obj() &&
      date(v.due) &&
      integer(v.successes, 10000) &&
      integer(v.interval, 3650) &&
      ["good", "again", "hard", "easy"].includes(v.lastRating) &&
      (v.ease === undefined ||
        (typeof v.ease === "number" && v.ease >= 1.3 && v.ease <= 100)) &&
      str(v.reviewedAt, 40) &&
      (v.history === undefined ||
        (Array.isArray(v.history) &&
          v.history.length <= 1000 &&
          v.history.every(
            (h: any) =>
              h &&
              str(h.at, 40) &&
              ["good", "again", "hard", "easy"].includes(h.rating) &&
              integer(h.interval, 3650),
          )))
    );
  if (key.startsWith("study:"))
    return date(key.slice(6)) && obj() && integer(v.seconds, 86400);
  if (key.startsWith("alphabet:"))
    return (
      /^[ابتثجحخدذرزسشصضطظعغفقكلمنهوي]$/.test(key.slice(9)) &&
      obj() &&
      (v.known === undefined || typeof v.known === "boolean") &&
      (v.lastCorrect === undefined || typeof v.lastCorrect === "boolean") &&
      (v.attempts === undefined || integer(v.attempts))
    );
  if (key.startsWith("session:"))
    return (
      obj() &&
      date(v.date) &&
      integer(v.seconds, 86400) &&
      integer(v.answers, 50000) &&
      integer(v.good, 50000) &&
      v.good <= v.answers &&
      integer(v.read, 10000) &&
      ["guided", "review"].includes(v.kind)
    );
  if (key === "preferences")
    return (
      obj() &&
      (v.arabicScale === undefined ||
        [1, 1.2, 1.4, 1.6].includes(v.arabicScale)) &&
      (v.audioRate === undefined || [0.6, 0.8, 1].includes(v.audioRate)) &&
      (v.reviewLimit === undefined ||
        [5, 10, 20, 30].includes(v.reviewLimit)) &&
      (v.reducedMotion === undefined || typeof v.reducedMotion === "boolean")
    );
  if (key.startsWith("micro:"))
    return obj() && str(v.completedAt, 40) && str(v.source, 200);
  if (key.startsWith("saved:")) return typeof v === "boolean";
  if (key.startsWith("assessment:"))
    return (
      obj() &&
      integer(v.score, 10000) &&
      integer(v.total, 10000) &&
      v.score <= v.total &&
      typeof v.passed === "boolean" &&
      str(v.at, 40) &&
      Array.isArray(v.history) &&
      v.history.length <= 100
    );
  if (key === "last") return str(v, 200);
  if (key === "goal") return [10, 15, 20, 30, 45, 60].includes(v);
  if (key.startsWith("activity:")) return date(key.slice(9)) && v === true;
  if (key.startsWith("note:")) return str(v);
  if (key.startsWith("progress:"))
    return (
      obj() &&
      (v.read === undefined ||
        (Array.isArray(v.read) &&
          v.read.length <= 10000 &&
          v.read.every((n: unknown) => integer(n, 10000)))) &&
      (v.step === undefined || integer(v.step, 10000)) &&
      (v.done === undefined || typeof v.done === "boolean") &&
      (v.page === undefined ||
        (Number.isInteger(v.page) && v.page >= 1 && v.page <= 10000))
    );
  if (key.startsWith("answer:"))
    return (
      obj() &&
      (v.attempts === undefined || integer(v.attempts)) &&
      (v.automatic === undefined || typeof v.automatic === "boolean") &&
      (v.history === undefined ||
        (Array.isArray(v.history) &&
          v.history.length <= 1000 &&
          v.history.every(
            (h: any) =>
              h &&
              str(h.at, 40) &&
              str(h.text) &&
              ["good", "again", "model", "partial"].includes(h.rating) &&
              typeof h.automatic === "boolean",
          ))) &&
      (v.text === undefined || str(v.text)) &&
      (v.rating === undefined ||
        ["", "good", "again", "partial", "model"].includes(v.rating))
    );
  if (key.startsWith("card:"))
    return (
      v === null ||
      (obj() &&
        (v.schedule === undefined ||
          validRecord("review:answer:native:card", v.schedule)) &&
        str(v.front, 3000) &&
        str(v.back, 3000) &&
        str(v.level, 2) &&
        (!v.due || /^\d{4}-\d{2}-\d{2}$/.test(v.due)))
    );
  if (key.startsWith("quiz:"))
    return (
      v === null ||
      (obj() && str(v.question, 3000) && str(v.answer, 3000) && str(v.level, 2))
    );
  if (key.startsWith("lesson:"))
    return (
      v === null ||
      (obj() &&
        str(v.id, 200) &&
        str(v.title, 200) &&
        str(v.content) &&
        v.custom === true &&
        // C2 stays readable so older backups with personal C2 lessons still import.
        ["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(v.level) &&
        Array.isArray(v.exercises) &&
        v.exercises.length === 0 &&
        Array.isArray(v.sections) &&
        v.sections.length === 0)
    );
  return false;
}
