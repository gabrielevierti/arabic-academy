import { useEffect, useState } from "react";
import modules from "../data/micro-lessons.json";
import { loadCourse } from "../lib/course-loader";
import { useLanguage } from "../lib/i18n";
import { missingPrerequisites } from "../lib/prerequisites";
import NativeCourse, { Blocks } from "./native-course";
export default function MicroLessons({
  data,
  put,
  lessons,
}: {
  data: Record<string, any>;
  put: (k: string, v: any) => void;
  lessons: any[];
}) {
  const language = useLanguage(),
    en = language === "en",
    t = (a: string, b: string) => (en ? b : a),
    [id, setId] = useState(""),
    [doc, setDoc] = useState<any>(null),
    [step, setStep] = useState(-1),
    [error, setError] = useState(false);
  const module = modules.find((m) => m.id === id);
  useEffect(() => {
    if (!module) return;
    let live = true;
    setDoc(null);
    setError(false);
    loadCourse(module.source, language)
      .then((d) => live && setDoc(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [id, language]);
  if (!module)
    return (
      <section>
        <h1>{t("Micro-lezioni A0", "A0 micro-lessons")}</h1>
        <p>
          {t(
            "Cinque unità tematiche pilota, collegate al testo originale. Completamento della pratica, non certificazione di padronanza.",
            "Five topic-based pilot units linked to the original text. Practice completion, not certification of mastery.",
          )}
        </p>
        <div className="lesson-list">
          {modules.map((m) => {
            const missing = missingPrerequisites(m.prerequisites, data);
            return (
              <button
                className="lesson-row"
                key={m.id}
                disabled={!!missing.length}
                onClick={() => {
                  setId(m.id);
                  setStep(-1);
                }}
              >
                <span>{data["micro:" + m.id]?.completedAt ? "✓" : "○"}</span>
                <div>
                  <h2>{m.objective[language]}</h2>
                  <small>
                    {missing.length
                      ? t("Prima completa: ", "Complete first: ") +
                        missing.join(", ")
                      : t(
                          "Leggi · richiama · pratica",
                          "Read · recall · practise",
                        )}
                  </small>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  function finish() {
    put("micro:" + module!.id, {
      completedAt: new Date().toISOString(),
      source: module!.source,
    });
    setStep(module!.questions.length);
  }
  return (
    <section>
      <button className="back" onClick={() => setId("")}>
        {t("← Micro-lezioni", "← Micro-lessons")}
      </button>
      <h1>{module.objective[language]}</h1>
      {!doc ? (
        <p role="status">
          {error
            ? t(
                "Contenuto non disponibile. Torna indietro e riprova.",
                "Content unavailable. Go back and retry.",
              )
            : t("Caricamento…", "Loading…")}
        </p>
      ) : step < 0 ? (
        <article className="panel">
          <Blocks blocks={doc.chapters[module.chapter].blocks} />
          <p className="spaced">
            {t(
              "Prima di continuare: copri la spiegazione e prova a riassumere la regola a voce.",
              "Before continuing: cover the explanation and try to recall the rule aloud.",
            )}
          </p>
          <button className="primary" onClick={() => setStep(0)}>
            {t("Passa alla pratica", "Start practice")}
          </button>
        </article>
      ) : step < module.questions.length ? (
        <NativeCourse
          key={id + step}
          lesson={lessons.find((l) => l.id === module.source)}
          data={data}
          put={put}
          target={{ groupId: "starter", questionId: module.questions[step] }}
          compact
          entryTab="practice"
          onBack={() => setStep(-1)}
          onAdvance={() =>
            step + 1 === module.questions.length ? finish() : setStep(step + 1)
          }
          onNext={finish}
          onFlashcard={() => {}}
        />
      ) : (
        <div className="panel">
          <h2>{t("Unità completata", "Unit completed")}</h2>
          <p>
            {t(
              "Hai letto e svolto le attività. Le risposte da rivedere sono nel ripasso; questa conclusione non equivale a padronanza verificata.",
              "You read and practised. Mistakes are available in review; this completion does not mean verified mastery.",
            )}
          </p>
          <button className="primary" onClick={() => setId("")}>
            {t("Prossima unità", "Next unit")}
          </button>
        </div>
      )}
    </section>
  );
}
