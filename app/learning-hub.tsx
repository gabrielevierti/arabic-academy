import { useState } from "react";
import { useLanguage } from "../lib/i18n";
import { errorQueue, localDay, streak } from "../lib/learning";
import { LEVELS, levelOf } from "../lib/levels";
export function Dashboard({
  data,
  current,
  due,
  onStudy,
  onLesson,
  onAlphabet,
  onReview,
  onStats,
}: {
  data: any;
  current: any;
  due: number;
  onStudy: () => void;
  onLesson: () => void;
  onAlphabet: () => void;
  onReview: () => void;
  onStats: () => void;
}) {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a);
  const errors = errorQueue(data).length,
    minutes = Math.floor((data["study:" + localDay()]?.seconds || 0) / 60),
    goal = data.goal || 15;
  const known = Object.entries(data).filter(
    ([k, v]: any) => k.startsWith("alphabet:") && v?.known,
  ).length;
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">
            {t("IL MIO SPAZIO · OGGI", "MY DASHBOARD · TODAY")}
          </div>
          <h1>
            {t("Un po’ di arabo, ogni giorno.", "A little Arabic, every day.")}
          </h1>
          <p>
            {t(
              "Un piccolo passo è già un buon inizio.",
              "One small step is a good start.",
            )}
          </p>
        </div>
        <span className="date">
          {new Date().toLocaleDateString(en ? "en-GB" : "it-IT", {
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
      <div className="today-layout">
        <section className="today-hero">
          <div className="eyebrow">
            {t(`${goal} MINUTI PER TE`, `${goal} MINUTES FOR YOU`)}
          </div>
          <h2>
            {t(
              "Ritrova il filo.\nFai un passo avanti.",
              "Pick up the thread.\nTake one step forward.",
            )}
          </h2>
          <p>
            {t(
              "Un ripasso mirato, una spiegazione e qualche domanda. Prepariamo noi la sessione.",
              "A focused review, an explanation and a few questions. We’ll put the session together.",
            )}
          </p>
          <div className="session-recipe">
            <span>01 {t("Ripassa", "Review")}</span>
            <i>→</i>
            <span>02 {t("Impara", "Learn")}</span>
            <i>→</i>
            <span>03 {t("Prova", "Practise")}</span>
          </div>
          <button className="primary light" onClick={onStudy}>
            {t(`Studia ${goal} minuti`, `Study for ${goal} minutes`)}{" "}
            <span>↗</span>
          </button>
          <span className="today-art" aria-hidden="true">
            ع
          </span>
        </section>
        <section className="panel today-goal">
          <div className="eyebrow">{t("IL TUO RITMO", "YOUR PACE")}</div>
          <div
            className="goal-orbit"
            style={{
              background: `conic-gradient(#277167 ${Math.min(100, (minutes / goal) * 100)}%,#edf1eb 0)`,
            }}
          >
            <div>
              <strong>{minutes}</strong>
              <small>/ {goal} min</small>
            </div>
          </div>
          <h3>
            {minutes >= goal
              ? t("Obiettivo raggiunto. Ben fatto.", "Goal reached. Well done.")
              : t("Ogni minuto conta.", "Every minute counts.")}
          </h3>
          <p>
            {streak(data)}{" "}
            {streak(data) === 1
              ? t("giorno consecutivo", "day streak")
              : t("giorni consecutivi", "day streak")}
          </p>
          <button className="text-button" onClick={onStats}>
            {t("Guarda i tuoi progressi →", "View your progress →")}
          </button>
        </section>
      </div>
      <div className="section-heading">
        <h2>
          {t("Da dove vuoi ripartire?", "Where would you like to start?")}
        </h2>
      </div>
      <div className="focus-cards">
        <button className="panel focus-card" onClick={onLesson}>
          <span className="focus-symbol">↗</span>
          <span className="eyebrow">
            {t("LA TUA LEZIONE", "YOUR LESSON")} · {current.code}
          </span>
          <h3>{current.title}</h3>
          <p>
            {t(
              "Riprendi con calma, dal tuo ultimo passaggio.",
              "Continue at your own pace from your last step.",
            )}
          </p>
          <b>{t("Riprendi la lezione →", "Resume lesson →")}</b>
        </button>
        <button className="panel focus-card" onClick={onReview}>
          <span className="focus-symbol">↻</span>
          <span className="eyebrow">
            {t("DA CONSOLIDARE", "TO CONSOLIDATE")}
          </span>
          <h3>
            {errors
              ? `${errors} ` +
                (errors === 1
                  ? t("domanda da ritrovare", "question to revisit")
                  : t("domande da ritrovare", "questions to revisit"))
              : t("Tieni vive le tue parole.", "Keep your words fresh.")}
          </h3>
          <p>
            {errors
              ? t(
                  "Riparti dagli errori, senza perdere i progressi.",
                  "Build on your mistakes without losing progress.",
                )
              : `${due} ` +
                t(
                  "flashcard in programma per oggi.",
                  "flashcards scheduled for today.",
                )}
          </p>
          <b>{t("Apri il ripasso →", "Open review →")}</b>
        </button>
        <button
          className="panel focus-card alphabet-teaser"
          onClick={onAlphabet}
        >
          <span className="focus-symbol" lang="ar">
            ب
          </span>
          <span className="eyebrow">
            {t("LE FONDAMENTA", "THE FOUNDATIONS")}
          </span>
          <h3>
            {t("Fai amicizia con le lettere.", "Get to know the letters.")}
          </h3>
          <p>
            {known}/28{" "}
            {t(
              "familiari. Forme, suoni e un piccolo quiz.",
              "familiar. Shapes, sounds and a short quiz.",
            )}
          </p>
          <b>{t("Esplora l’alfabeto →", "Explore the alphabet →")}</b>
        </button>
      </div>
    </>
  );
}
export function PracticeHub({
  lessons,
  data,
  onOpen,
  onReview,
}: {
  lessons: any[];
  data: any;
  onOpen: (l: any) => void;
  onReview: () => void;
}) {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a);
  const [level, setLevel] = useState("A0"),
    [query, setQuery] = useState("");
  const errors = errorQueue(data).length;
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">
            {t("DALLA TEORIA ALLA PRATICA", "FROM THEORY TO PRACTICE")}
          </div>
          <h1>
            {t(
              "Metti alla prova ciò che sai.",
              "Put what you know into practice.",
            )}
          </h1>
          <p>
            {t(
              "Apri gli esercizi di una lezione, senza passare dalle spiegazioni.",
              "Open a lesson’s exercises directly, without going through the explanations.",
            )}
          </p>
        </div>
        {errors > 0 && (
          <button className="secondary" onClick={onReview}>
            {t("Ripassa", "Review")} {errors} {t("errori", "mistakes")} ↻
          </button>
        )}
      </div>
      <div className="filters">
        <div className="tabs">
          {LEVELS.map((l) => (
            <button
              key={l}
              className={l === level ? "chosen" : ""}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          aria-label={t("Cerca esercizi", "Search exercises")}
          placeholder={t("Cerca una lezione…", "Search lessons…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="practice-catalog">
        {lessons
          .filter(
            (l) =>
              levelOf(l) === level &&
              !l.custom &&
              l.nativeItems > 0 &&
              (l.title + " " + l.code)
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .map((l) => {
            const answers = Object.entries(data).filter(
              ([k, v]: any) =>
                k.startsWith("answer:native:" + l.id + ":") &&
                ["good", "again", "partial"].includes(v?.rating),
            );
            return (
              <button
                className="panel practice-tile"
                key={l.id}
                onClick={() => onOpen(l)}
              >
                <span className="eyebrow">{l.code}</span>
                <h3>{l.title}</h3>
                <p>
                  {answers.length}/{l.nativeItems}{" "}
                  {t("domande svolte", "questions answered")}
                </p>
                <div className="progress-track">
                  <i
                    style={{
                      width: (answers.length / l.nativeItems) * 100 + "%",
                    }}
                  />
                </div>
                <span className="text-button">
                  {t("Allenati →", "Practise →")}
                </span>
              </button>
            );
          })}
      </div>
      {!lessons.some(
        (l) =>
          levelOf(l) === level &&
          !l.custom &&
          l.nativeItems > 0 &&
          (l.title + " " + l.code).toLowerCase().includes(query.toLowerCase()),
      ) && (
        <p className="panel empty">
          {t(
            "Nessuna lezione corrisponde alla ricerca.",
            "No lessons match your search.",
          )}
        </p>
      )}
    </>
  );
}
export function ErrorReview({
  data,
  lessons,
  onStart,
}: {
  data: any;
  lessons: any[];
  onStart: () => void;
}) {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a);
  const valid = (x: any) => lessons.some((l) => l.id === x.lessonId);
  const due = errorQueue(data).filter(valid),
    all = errorQueue(data, localDay(), false).filter(valid);
  const grouped = new Map<string, number>();
  due.forEach((x) =>
    grouped.set(x.lessonId, (grouped.get(x.lessonId) || 0) + 1),
  );
  return (
    <section className="panel error-review">
      <div className="row">
        <div>
          <div className="eyebrow">
            {t("DAGLI ERRORI SI RIPARTE", "BUILD ON YOUR MISTAKES")}
          </div>
          <h2>
            {due.length
              ? `${due.length} ` +
                (due.length === 1
                  ? t("domanda da ripassare oggi", "question due today")
                  : t("domande da ripassare oggi", "questions due today"))
              : t(
                  "Nessun errore da ripassare oggi.",
                  "No mistakes due for review today.",
                )}
          </h2>
        </div>
        <span className="review-mark">↻</span>
      </div>
      <p>
        {t(
          "Gli errori entrano qui automaticamente. Dopo una risposta corretta tornano a intervalli adattivi SM-2; se sbagli, riparti da oggi.",
          "Mistakes appear here automatically. After a correct answer, they return in adaptive SM-2 intervals; after a mistake, they are due again today.",
        )}
      </p>
      {due.length > 0 && (
        <>
          <button className="primary spaced" onClick={onStart}>
            {t("Ripassa gli errori", "Review mistakes")} ·{" "}
            {Math.min(10, due.length)}{" "}
            {due.length === 1
              ? t("domanda", "question")
              : t("domande", "questions")}
          </button>
          <div className="review-origins">
            {[...grouped].map(([id, n]) => (
              <span key={id}>
                {lessons.find((l) => l.id === id)?.code} · {n}
              </span>
            ))}
          </div>
        </>
      )}
      {all.length > due.length && (
        <small>
          {all.length - due.length}{" "}
          {t(
            "domande corrette, in attesa del prossimo ripasso.",
            "corrected questions scheduled for a later review.",
          )}
        </small>
      )}
    </section>
  );
}
