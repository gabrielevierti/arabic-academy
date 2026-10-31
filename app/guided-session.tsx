import { tasksForLesson, taskId } from "../lib/session-planner";
import { useEffect, useRef, useState } from "react";
import NativeCourse, { Blocks } from "./native-course";
import { useStudyTime } from "../lib/use-study-time";
import { loadCourse } from "../lib/course-loader";
import { useLanguage } from "../lib/i18n";
import { errorQueue, localDay, type Target } from "../lib/learning";
type Props = {
  data: Record<string, any>;
  put: (key: string, value: any) => void;
  lessons: any[];
  current: any;
  onExit: () => void;
  onFlashcard: () => void;
  review?: boolean;
  onRestart: () => void;
};
export default function GuidedSession({
  data,
  put,
  lessons,
  current,
  onExit,
  onFlashcard,
  review = false,
  onRestart,
}: Props) {
  const language = useLanguage(),
    en = language === "en",
    t = (it: string, eng: string) => (en ? eng : it);
  const [plan, setPlan] = useState<
      { kind: string; target?: Target; chapter?: number; lessonId: string }[]
    >([]),
    [step, setStep] = useState(0),
    [doc, setDoc] = useState<any>(null),
    [error, setError] = useState(false),
    [ready, setReady] = useState(false),
    [paused, setPaused] = useState(false),
    [seconds, setSeconds] = useState(0),
    [finished, setFinished] = useState(false),
    [results, setResults] = useState({ answers: 0, good: 0, read: 0 });
  useStudyTime(
    ready && !paused && !finished && plan.length > 0,
    data,
    put,
    (delta) => setSeconds((s) => s + delta),
  );
  const goal = data.goal || 15;
  const expanding = useRef(false),
    seen = useRef(new Set<string>());
  const [exhausted, setExhausted] = useState(false);
  const initial = useRef({ data, current, lessons, language });
  const saved = useRef(false);
  useEffect(() => {
    let live = true;
    async function build() {
      try {
        const s = initial.current;
        const targets = errorQueue(s.data)
          .filter((x) => s.lessons.some((l) => l.id === x.lessonId))
          .slice(0, review ? s.data.preferences?.reviewLimit || 10 : 3);
        // Resolve targets before presenting them so stale imported identifiers are skipped.
        const docs = new Map<string, any>();
        for (const id of new Set([
          ...targets.map((x) => x.lessonId),
          ...(review ? [] : [s.current.id]),
        ]))
          docs.set(id, await loadCourse(id, s.language));
        const tasks: any[] = targets
          .filter((x) =>
            docs
              .get(x.lessonId)
              ?.exercises.some(
                (g: any) =>
                  g.id === x.groupId &&
                  g.items.some((q: any) => q.id === x.questionId),
              ),
          )
          .map((target) => ({
            kind: "review",
            target,
            lessonId: target.lessonId,
          }));
        if (!review) {
          const d = docs.get(s.current.id);
          const read = s.data["progress:" + s.current.id]?.read || [];
          // Chapters that only point to exercises are covered by the practice step.
          const chapter = d.chapters.findIndex(
            (c: any, i: number) => !read.includes(i) && !c.exercisesOnly,
          );
          if (chapter >= 0)
            tasks.push({ kind: "learn", chapter, lessonId: s.current.id });
          const questions = d.exercises.flatMap((g: any) =>
            g.items.map((q: any) => ({
              lessonId: s.current.id,
              groupId: g.id,
              questionId: q.id,
              key: "answer:native:" + s.current.id + ":" + g.id + ":" + q.id,
            })),
          );
          const fresh = questions.filter(
            (q: Target) =>
              !s.data[q.key]?.rating && !targets.some((x) => x.key === q.key),
          );
          const practice = (
            fresh.length
              ? fresh
              : questions.filter(
                  (q: Target) => !targets.some((x) => x.key === q.key),
                )
          ).slice(0, 3);
          tasks.push(
            ...practice.map((target: Target) => ({
              kind: "practice",
              target,
              lessonId: target.lessonId,
            })),
          );
        }
        if (live) {
          tasks.forEach((t: any) => seen.current.add(taskId(t)));
          setPlan(tasks);
          setReady(true);
        }
      } catch {
        if (live) setError(true);
      }
    }
    build();
    return () => {
      live = false;
    };
  }, [review]);
  const task = plan[step];
  useEffect(() => {
    let live = true;
    setDoc(null);
    setError(false);
    if (task?.kind === "learn")
      loadCourse(task.lessonId, language)
        .then((d) => live && setDoc(d))
        .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [task?.lessonId, task?.chapter, task?.kind, language]);
  function finish() {
    const summary = { ...results };
    if (task?.target) {
      const a = data[task.target.key],
        old = initial.current.data[task.target.key];
      if (
        ["good", "again", "partial"].includes(a?.rating) &&
        (a?.attempts || 0) > (old?.attempts || 0)
      ) {
        summary.answers++;
        if (a.rating === "good") summary.good++;
      }
    }
    setResults(summary);
    if (!saved.current) {
      saved.current = true;
      put(
        "session:" +
          Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
            n.toString(16),
          ).join("-"),
        {
          date: localDay(),
          seconds: Math.floor(seconds),
          answers: summary.answers,
          good: summary.good,
          read: summary.read,
          kind: review ? "review" : "guided",
        },
      );
    }
    setFinished(true);
  }
  function next() {
    if (task.kind === "learn") {
      const key = "progress:" + task.lessonId,
        p = data[key] || {};
      put(key, {
        ...p,
        read: [...new Set([...(p.read || []), task.chapter])],
        step: task.chapter,
      });
      put("activity:" + localDay(), true);
      setResults((r) => ({ ...r, read: r.read + 1 }));
    } else {
      setResults((r) => ({
        ...r,
        answers: r.answers + 1,
        good: r.good + (data[task.target!.key]?.rating === "good" ? 1 : 0),
      }));
    }
    setStep((s) => s + 1);
  }
  // Extend the same session and timer until the selected goal or content exhaustion.
  useEffect(() => {
    if (!ready || step < plan.length || finished || expanding.current) return;
    if (review || seconds >= goal * 60) {
      finish();
      return;
    }
    expanding.current = true;
    let live = true;
    (async () => {
      try {
        const ordered = [
          current,
          ...lessons.filter((l) => !l.custom && l.id !== current.id),
        ];
        for (const l of ordered) {
          const d = await loadCourse(l.id, language);
          const tasks = tasksForLesson(d, data, seen.current);
          if (tasks.length) {
            tasks.forEach((t) => seen.current.add(taskId(t)));
            if (live) setPlan((p) => [...p, ...tasks]);
            return;
          }
        }
        if (live) {
          setExhausted(true);
          finish();
        }
      } catch {
        if (live) {
          setError(true);
          setExhausted(true);
          finish();
        }
      } finally {
        expanding.current = false;
      }
    })();
    return () => {
      live = false;
    };
  }, [step, ready, plan.length]);
  const labels = {
    review: t("Ripassa", "Review"),
    learn: t("Impara", "Learn"),
    practice: t("Allenati", "Practice"),
  };
  if (finished || (ready && !plan.length))
    return (
      <section className="panel guided-finish">
        <span className="finish-mark">✓</span>
        <div className="eyebrow">
          {t("IL TEMPO CHE DEDICHI CONTA", "YOUR TIME MATTERS")}
        </div>
        <h1>
          {plan.length
            ? t("Un altro passo avanti.", "One more step forward.")
            : t("Sei in pari.", "You’re all caught up.")}
        </h1>
        <p>
          {plan.length
            ? t(
                "Hai fatto spazio all’arabo. Le risposte e i passaggi letti sono già nei tuoi progressi.",
                "You made time for Arabic. Your answers and completed reading steps are saved.",
              )
            : t(
                "Non ci sono errori da ripassare oggi.",
                "There are no errors due for review today.",
              )}
        </p>
        {exhausted && (
          <p>
            {error
              ? t(
                  "Altri contenuti non disponibili. I progressi già fatti restano salvati.",
                  "More content could not be loaded. Existing progress is retained.",
                )
              : t(
                  "Non ci sono altre attività nuove disponibili. Puoi ripassare dal percorso.",
                  "No new activities are available. You can revisit the course.",
                )}
          </p>
        )}
        {plan.length > 0 && (
          <div className="finish-stats">
            <div>
              <strong>
                {Math.floor(seconds / 60)}:
                {String(Math.floor(seconds % 60)).padStart(2, "0")}
              </strong>
              <span>{t("tempo attivo", "active time")}</span>
            </div>
            <div>
              <strong>
                {results.good}/{results.answers}
              </strong>
              <span>
                {t("corrette o confermate", "correct or self-confirmed")}
              </span>
            </div>
            <div>
              <strong>{results.read}</strong>
              <span>{t("passaggi letti", "reading steps")}</span>
            </div>
          </div>
        )}
        {plan.length > 0 && !review && (
          <button className="primary" onClick={onRestart}>
            {t("Continua con altre attività", "Continue with more activities")}
          </button>
        )}
        <button className="secondary spaced" onClick={onExit}>
          {t("Torna al corso", "Back to my dashboard")}
        </button>
      </section>
    );
  return (
    <div className="guided">
      <div className="session-toolbar">
        <div>
          <span className="eyebrow">
            {review
              ? t("RIPASSO DEGLI ERRORI", "REVIEW YOUR MISTAKES")
              : `${goal} MIN`}
          </span>
          <h2>
            {review
              ? t(
                  "Riproviamo, un punto alla volta.",
                  "Let’s try again, one point at a time.",
                )
              : t("Un po’ ogni giorno.", "A little, every day.")}
          </h2>
        </div>
        <span
          className="session-clock"
          aria-label={t("Tempo attivo", "Active time")}
        >
          {Math.floor(seconds / 60)}:
          {String(Math.floor(seconds % 60)).padStart(2, "0")}
          {!review && ` / ${goal}:00`}
        </span>
        <button className="secondary" onClick={() => setPaused(!paused)}>
          {paused ? t("Riprendi", "Resume") : t("Pausa", "Pause")}
        </button>
        <button className="back" onClick={finish}>
          {t("Termina", "Finish")}
        </button>
      </div>
      <p className="muted session-caption">
        {t(
          "Il tempo è un obiettivo, non un obbligo. Puoi terminare quando vuoi. Il timer conta solo lo studio attivo nella finestra in uso.",
          "The goal is optional. You can finish whenever you want. The timer counts active study in the focused window only.",
        )}
      </p>
      {!ready ? (
        <div className="panel empty">
          <p>
            {error
              ? t(
                  "Non riesco a caricare le attività. Torna indietro e riprova.",
                  "Could not load activities. Go back and try again.",
                )
              : t("Preparo la tua sessione…", "Preparing your session…")}
          </p>
          <button className="back" onClick={onExit}>
            {t("Indietro", "Back")}
          </button>
        </div>
      ) : paused ? (
        <div className="panel empty">
          <h2>{t("Prenditi il tuo tempo.", "Take your time.")}</h2>
          <button className="primary" onClick={() => setPaused(false)}>
            {t("Riprendi la sessione", "Resume session")}
          </button>
        </div>
      ) : (
        task && (
          <>
            <div className="session-steps">
              {plan.map((p, i) => (
                <span
                  key={i}
                  className={i === step ? "current" : i < step ? "past" : ""}
                >
                  {i < step ? "✓" : i + 1}{" "}
                  {labels[p.kind as keyof typeof labels]}
                </span>
              ))}
            </div>
            {task.kind === "learn" ? (
              <article className="panel session-reading">
                {doc ? (
                  <>
                    <span className="eyebrow">
                      {t("UN NUOVO PASSAGGIO", "A NEW STEP")} · {task.lessonId}
                    </span>
                    <h2>{doc.chapters[task.chapter!]?.title}</h2>
                    <Blocks blocks={doc.chapters[task.chapter!]?.blocks} />
                    <button className="primary spaced" onClick={next}>
                      {t(
                        "Ho letto, passiamo alla pratica →",
                        "I’ve read this, let’s practise →",
                      )}
                    </button>
                  </>
                ) : (
                  <p>
                    {error
                      ? t(
                          "Caricamento non riuscito. Termina e riprova.",
                          "Loading failed. Finish and try again.",
                        )
                      : t("Caricamento…", "Loading…")}
                  </p>
                )}
              </article>
            ) : (
              <NativeCourse
                key={task.target!.key}
                lesson={lessons.find((l) => l.id === task.lessonId)}
                data={data}
                put={put}
                entryTab="practice"
                target={task.target}
                compact
                onAdvance={next}
                onBack={onExit}
                onNext={next}
                onFlashcard={onFlashcard}
              />
            )}
          </>
        )
      )}
    </div>
  );
}
