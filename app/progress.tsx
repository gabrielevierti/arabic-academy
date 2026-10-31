import { useLanguage } from "../lib/i18n";
import { levelMetrics, localDay, streak, errorQueue } from "../lib/learning";
import metadata from "../data/study-metadata.json";
import { LEVELS } from "../lib/levels";
const levels: readonly string[] = LEVELS;
export default function Progress({
  data,
  lessons,
  onStudy,
}: {
  data: Record<string, any>;
  lessons: any[];
  onStudy: () => void;
}) {
  const en = useLanguage() === "en",
    t = (it: string, eng: string) => (en ? eng : it);
  const metrics = levels.map((l) => levelMetrics(lessons, metadata, data, l));
  const active = metrics.findIndex((m) => m.total > 0 && m.done < m.total);
  const m = metrics[active];
  const seconds = Object.entries(data)
    .filter(([k]) => k.startsWith("study:"))
    .reduce((sum, [, v]) => sum + (v.seconds || 0), 0);
  const answers = Object.entries(data).filter(
    ([k, v]) =>
      k.startsWith("answer:native:") &&
      ["good", "again", "partial"].includes(v?.rating),
  );
  const good = answers.filter(([, v]) => v.rating === "good").length,
    automatic = answers.filter(([, v]) => v.automatic === true),
    autoGood = automatic.filter(([, v]) => v.rating === "good").length;
  const completed = metrics.reduce((n, m) => n + m.done, 0),
    sessions = Object.keys(data).filter((k) => k.startsWith("session:")).length,
    known = Object.entries(data).filter(
      ([k, v]) => k.startsWith("alphabet:") && v?.known,
    ).length;
  const milestones = [
    [
      t("Il primo passo", "The first step"),
      answers.length > 0,
      t("Rispondi a una domanda", "Answer a question"),
    ],
    [
      t("La prima sessione", "Your first session"),
      sessions > 0,
      t("Concludi una sessione", "Finish a session"),
    ],
    [
      t("Le basi prendono forma", "Building the foundations"),
      known >= 5,
      t("Segna 5 lettere come familiari", "Mark 5 letters as familiar"),
    ],
    [
      t("La tua prima lezione", "Your first lesson"),
      completed > 0,
      t("Completa una lezione", "Complete a lesson"),
    ],
    [
      t("Costanza, senza fretta", "Consistency, at your pace"),
      Object.keys(data).filter((k) => k.startsWith("activity:") && data[k])
        .length >= 7,
      t(
        "Studia in 7 giorni, anche non consecutivi",
        "Study on 7 days, not necessarily consecutive",
      ),
    ],
  ];
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">
            {t("OGNI PASSO LASCIA IL SEGNO", "EVERY STEP COUNTS")}
          </div>
          <h1>
            {t("Stai costruendo qualcosa.", "You’re building something.")}
          </h1>
          <p>
            {t(
              "Guarda ciò che hai fatto. Scegli il prossimo piccolo traguardo.",
              "See what you’ve done. Choose your next small milestone.",
            )}
          </p>
        </div>
        <button className="primary" onClick={onStudy}>
          {t(
            `Studia ${data.goal || 15} minuti`,
            `Study for ${data.goal || 15} minutes`,
          )}
        </button>
      </div>
      <div className="progress-summary">
        <div className="panel">
          <span className="eyebrow">{t("TEMPO ATTIVO", "ACTIVE TIME")}</span>
          <strong>
            {Math.floor(seconds / 3600)}
            <small>h</small> {Math.floor((seconds % 3600) / 60)}
            <small>min</small>
          </strong>
          <p>
            {t("Misurato da questo aggiornamento", "Tracked since this update")}
          </p>
        </div>
        <div className="panel">
          <span className="eyebrow">
            {t("GIORNI CONSECUTIVI", "DAY STREAK")}
          </span>
          <strong>{streak(data)}</strong>
          <p>{t("Puoi sempre ricominciare", "You can always start again")}</p>
        </div>
        <div className="panel">
          <span className="eyebrow">
            {t("RISPOSTE CORRETTE / CONFERMATE", "CORRECT / SELF-CONFIRMED")}
          </span>
          <strong>
            {good}
            <small> / {answers.length}</small>
          </strong>
          <p>
            {t(
              "Ultimo esito delle domande svolte",
              "Latest result for answered questions",
            )}
          </p>
        </div>
      </div>
      <section className="panel next-level">
        <div>
          <span className="eyebrow">
            {t("IL PROSSIMO TRAGUARDO", "YOUR NEXT MILESTONE")}
          </span>
          <h2>
            {m
              ? t("Completa il percorso", "Complete the course") +
                " " +
                levels[active]
              : t(
                  "Hai completato i livelli disponibili.",
                  "You’ve completed the available levels.",
                )}
          </h2>
          <p>
            {m
              ? `${m.done}/${m.total} ` +
                t("lezioni principali completate", "core lessons completed")
              : t(
                  "Hai concluso tutte le lezioni principali, dall’alfabeto al C1. Ripassa, riprendi le tracce di varietà e continua con i testi autentici.",
                  "You have completed every core lesson, from the alphabet to C1. Review, return to the variety tracks and keep reading authentic texts.",
                )}
          </p>
          {m && (
            <div className="progress-track">
              <i style={{ width: (100 * m.done) / m.total + "%" }} />
            </div>
          )}
        </div>
        {m && (
          <div className="remaining-hours">
            <strong>
              {m.low === m.high ? m.low : `${m.low}–${m.high}`} <small>h</small>
            </strong>
            <span>
              {t("di studio rimanenti, stimate", "estimated study remaining")}
            </span>
            <small>
              {active < levels.length - 1
                ? t("Prima di proseguire con", "Before moving on to") +
                  " " +
                  levels[active + 1]
                : t(
                    "Per concludere il C1, l’ultimo livello del percorso",
                    "To finish C1, the last level of the course",
                  )}
            </small>
          </div>
        )}
      </section>
      <section className="panel spaced">
        <h2>
          {t("Evidenze, non certificazioni", "Evidence, not certificates")}
        </h2>
        <p>
          {t(
            "Le spunte delle lezioni, incluse quelle storiche, indicano contenuto completato. Le autovalutazioni non sono prove indipendenti.",
            "Lesson checkmarks, including legacy records, indicate completed content. Self-assessment is not independent evidence.",
          )}
        </p>
        <p>
          {t("Riconoscimento forme A0", "A0 form recognition")}:{" "}
          {data["assessment:A0-letter-forms"]
            ? `${data["assessment:A0-letter-forms"].score}/5`
            : t("Non ancora valutato", "Not yet assessed")}
        </p>
        <p>
          {t(
            "Lettura estesa, ascolto, scrittura, grammatica, lessico e produzione orale: non ancora valutati con prove indipendenti.",
            "Extended reading, listening, writing, grammar, vocabulary and speaking: not yet independently assessed.",
          )}
        </p>
        <p>
          {t(
            "Accuratezza al primo tentativo registrato",
            "Accuracy on first recorded attempt",
          )}
          :{" "}
          {(() => {
            const first = answers
              .map(([, v]) => v.firstAttempt)
              .filter((v) => v?.automatic);
            return first.length
              ? `${Math.round((100 * first.filter((v) => v.rating === "good").length) / first.length)}% (${first.length})`
              : "—";
          })()}
        </p>
      </section>
      <details className="estimate-method">
        <summary>
          {t(
            "Come calcoliamo tempo e stime?",
            "How do we calculate time and estimates?",
          )}
        </summary>
        <p>
          {t(
            "Le ore previste provengono dalle schede delle lezioni principali e includono studio e pratica. Il residuo diminuisce per metà con i passaggi letti e per metà con le risposte corrette o autovalutate; una lezione segnata completa azzera il suo residuo. Le tracce complementari sono escluse. È una guida di pianificazione, non una previsione di competenza o una certificazione.",
            "Expected hours come from core lesson plans and include study and practice. Half of the remaining estimate decreases with reading steps, half with correct or self-assessed answers; a lesson marked complete has no remaining hours. Supplementary tracks are excluded. This is a planning guide, not a proficiency forecast or certification.",
          )}
        </p>
        <p>
          {t(
            "Il tempo attivo conta solo durante lezioni, alfabeto e sessioni, con scheda visibile e interazioni nell’ultimo minuto. Il tempo precedente a questo aggiornamento non è ricostruito.",
            "Active time is counted only in lessons, the alphabet and sessions, while the tab is visible and there has been interaction within the last minute. Earlier study time cannot be reconstructed.",
          )}
        </p>
      </details>
      <div className="progress-detail-grid">
        <section className="panel">
          <h2>
            {t(
              "Il percorso, visto da vicino",
              "A closer look at your progress",
            )}
          </h2>
          <div className="progress-levels">
            {levels.map((l, i) => {
              const x = metrics[i];
              return (
                <div className="progress-level" key={l}>
                  <div className="row">
                    <strong>{l}</strong>
                    <span>
                      {x.total
                        ? `${x.done}/${x.total} ` + t("lezioni", "lessons")
                        : t("In arrivo", "Coming soon")}
                    </span>
                  </div>
                  <div className="progress-track">
                    <i
                      style={{
                        width: x.total ? (x.done / x.total) * 100 + "%" : "0%",
                      }}
                    />
                  </div>
                  {x.total > 0 && (
                    <small>
                      {x.read}/{x.chapters}{" "}
                      {t("passaggi letti", "reading steps")} · {x.answered}/
                      {x.questions} {t("domande svolte", "questions answered")}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <h2>{t("Piccoli traguardi", "Small milestones")}</h2>
          <div className="milestones">
            {milestones.map(([label, yes, hint]) => (
              <div key={String(label)} className={yes ? "earned" : ""}>
                <span>{yes ? "✓" : "○"}</span>
                <div>
                  <b>{label}</b>
                  <small>{hint}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="accuracy-note">
            <strong>
              {automatic.length
                ? Math.round((autoGood / automatic.length) * 100) + "%"
                : "—"}
            </strong>
            <p>
              {t(
                "Corrette tra le risposte con verifica automatica. Le autovalutazioni non entrano in questa percentuale.",
                "Correct among automatically checked answers. Self-assessments are excluded from this percentage.",
              )}
            </p>
          </div>
        </section>
      </div>
      <section className="panel spaced">
        <div className="row">
          <h2>
            {t(
              "La tua costanza, negli ultimi 28 giorni",
              "Your consistency over the last 28 days",
            )}
          </h2>
          <span>
            {errorQueue(data).length}{" "}
            {t("errori da ripassare oggi", "mistakes due today")}
          </span>
        </div>
        <div className="activity-grid">
          {Array.from({ length: 28 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (27 - i));
            const key = localDay(d),
              yes = !!data["activity:" + key];
            return (
              <div
                key={key}
                className={yes ? "active-day" : ""}
                aria-label={
                  key +
                  " · " +
                  (yes
                    ? t("attività registrata", "activity recorded")
                    : t("nessuna attività", "no activity"))
                }
                title={key}
              >
                {d.getDate()}
              </div>
            );
          })}
        </div>
        <p>
          {t(
            "I giorni vuoti non cancellano ciò che hai imparato.",
            "Empty days don’t erase what you have learnt.",
          )}
        </p>
      </section>
    </>
  );
}
