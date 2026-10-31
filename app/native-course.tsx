import WordPronunciation from "./word-pronunciation";
import { tr, useLanguage } from "../lib/i18n";
("use client");
import { useEffect, useRef, useState } from "react";
import SpeakingPractice from "./speaking-practice";
import { playArabic } from "../lib/audio";
import ContextualVocabulary from "./contextual-vocabulary";
import { evaluateAnswer, withAttempt } from "../lib/grading";
import { loadCourse } from "../lib/course-loader";
type Any = Record<string, any>;
/** True for text written only in Arabic (punctuation and digits allowed). */
const arabicOnly = (s?: string) =>
  !!s && /[\u0621-\u064a]/.test(s) && !/[A-Za-z\u00c0-\u024f\u1e00-\u1eff]/.test(s);
export function Rich({ text = "", onWord }: { text?: string; onWord?:(word:string)=>void }) {
 function content(value:string){return onWord?value.split(/([\p{Script=Arabic}\p{Mark}]+)/gu).map((part,i)=>/\p{Script=Arabic}/u.test(part)?<button key={i} type="button" className="arabic-word" onClick={()=>onWord(part)} aria-label={"Pronuncia di "+part}>{part}</button>:part):value}

  return (
    <>
      {String(text)
        .split(
          /(\u2067[^\u2069]*\u2069|[\p{Script=Arabic}\p{Mark}]+(?: [\p{Script=Arabic}\p{Mark}]+)*)/gu,
        )
        .map((p, i) =>
          p.startsWith("\u2067") ? (
            <bdi key={i} className="arabic-inline" dir="rtl" lang="ar">
              {content(p.slice(1, -1))}
            </bdi>
          ) : /\p{Script=Arabic}/u.test(p) ? (
            <bdi key={i} className="arabic-inline" dir="rtl" lang="ar">
              {content(p)}
            </bdi>
          ) : (
            p
          ),
        )}
    </>
  );
}
export function Blocks({
  blocks = [],
  onExercise,
}: {
  blocks?: any[];
  onExercise?: (id: string) => void;
}) {
  const [word, setWord] = useState("");
  return (
    <div className="native-prose">
      {word && (
        <WordPronunciation key={word} word={word} onClose={() => setWord("")} />
      )}
      {blocks.map((b, i) =>
        b.type === "table" ? (
          <div className="native-table-wrap" key={i}>
            <table
              className={
                "native-table" + (b.header === false ? " headless" : "")
              }
            >
              <tbody>
                {b.rows.map((r: any[], j: number) => (
                  <tr key={j}>
                    {r.map((c, k) => {
                      // A cell that is one Arabic isolate is laid out right to left.
                      const rtl = /^\u2067[^\u2066-\u2069]*\u2069$/.test(
                        String(c).trim(),
                      );
                      const dir = rtl ? { dir: "rtl", lang: "ar" } : {};
                      return j === 0 && b.header !== false ? (
                        <th key={k} scope="col" {...dir}>
                          <Rich onWord={setWord} text={c} />
                        </th>
                      ) : (
                        <td key={k} {...dir}>
                          <Rich onWord={setWord} text={c} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : b.type === "exercise" ? (
          onExercise ? (
            <button
              type="button"
              key={i}
              className="exercise-link"
              onClick={() => onExercise(b.id)}
            >
              <span className="eyebrow">{tr("ATTIVITÀ")}</span>
              <Rich text={b.title} />
              <b aria-hidden="true">→</b>
            </button>
          ) : (
            <p className="exercise-link static" key={i}>
              <Rich text={b.title} />
            </p>
          )
        ) : b.type === "heading" ? (
          b.level === 4 ? (
            <h4 key={i}>
              <Rich onWord={setWord} text={b.text} />
            </h4>
          ) : (
            <h3 key={i}>
              <Rich onWord={setWord} text={b.text} />
            </h3>
          )
        ) : b.type === "list" ? (
          <p className="native-list" key={i}>
            <Rich onWord={setWord} text={b.text} />
          </p>
        ) : b.type === "arabic" ? (
          <p
            className={"arabic-paragraph" + (b.emphasis ? " emphasis" : "")}
            key={i}
            dir="rtl"
            lang="ar"
          >
            <Rich onWord={setWord} text={b.text} />
          </p>
        ) : (
          <p key={i} className={b.small ? "native-note" : undefined}>
            <Rich onWord={setWord} text={b.text} />
          </p>
        ),
      )}
    </div>
  );
}
export function NativeResource({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const language = useLanguage();
  const [doc, setDoc] = useState<any>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    setDoc(null);
    setError(false);
    loadCourse(id, language)
      .then((d) => live && setDoc(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [id, language]);
  return (
    <>
      <button className="back" onClick={onBack}>
        {tr("← Torna alla biblioteca")}
      </button>
      {doc ? (
        <div className="panel resource-native">
          <div className="eyebrow">{tr("MATERIALE DEL TUO CORSO")}</div>
          <h1>{doc.title}</h1>
          <Blocks blocks={doc.blocks} />
        </div>
      ) : (
        <div className="empty panel">
          {error
            ? tr("Il contenuto non è disponibile. Riprova.")
            : tr("Caricamento del contenuto…")}
        </div>
      )}
    </>
  );
}
export default function NativeCourse({
  lesson,
  data,
  put,
  onBack,
  onNext,
  onFlashcard,
  entryTab = "learn",
  target,
  compact = false,
  onAdvance,
}: {
  lesson: any;
  data: Any;
  put: (k: string, v: any) => void;
  onBack: () => void;
  onNext: () => void;
  onFlashcard: () => void;
  entryTab?: string;
  target?: { groupId: string; questionId: string };
  compact?: boolean;
  onAdvance?: () => void;
}) {
  const language = useLanguage();
  const [native, setNative] = useState<any>(null),
    [error, setError] = useState(false),
    [tab, setTab] = useState("learn"),
    [chapter, setChapter] = useState(data["progress:" + lesson.id]?.step || 0),
    [group, setGroup] = useState(0),
    [itemIndex, setItemIndex] = useState(0),
    [reviewOnly, setReviewOnly] = useState(false),
    [reviewIds, setReviewIds] = useState<string[]>([]),
    [complete, setComplete] = useState(false),
    [showContext, setShowContext] = useState(false),
    [showFull, setShowFull] = useState(false),
    [order, setOrder] = useState<number[]>([]),
    [audioNotice, setAudioNotice] = useState("");
  const targetApplied = useRef("");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const gradingLock = useRef("");
  function saveAnswer(key: string, value: any) {
    setDrafts((d) => ({ ...d, [key]: value }));
    if (value.rating) {
      put(key, withAttempt(data[key] || {}, value));
      put("draft:" + key, null);
    } else {
      put("draft:" + key, value);
      if (!data[key]?.rating) put(key, value);
    }
  }
  const box = useRef<HTMLTextAreaElement>(null);
  const state = data["progress:" + lesson.id] || {};
  useEffect(() => {
    setTab(entryTab);
    setChapter(data["progress:" + lesson.id]?.step || 0);
    setGroup(0);
    setItemIndex(0);
    setComplete(false);
    setReviewOnly(false);
    setReviewIds([]);
    setOrder([]);
    setShowFull(false);
    setShowContext(false);
  }, [lesson.id]);
  useEffect(() => {
    let live = true;
    setNative(null);
    setError(false);
    loadCourse(lesson.id, language)
      .then((n: any) => {
        if (live) {
          setNative(n);
          setChapter((c: number) =>
            Math.min(c, Math.max(0, n.chapters.length - 1)),
          );
        }
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [lesson.id, language]);
  useEffect(() => {
    if (!native || !target) return;
    const token = lesson.id + ":" + target.groupId + ":" + target.questionId;
    if (targetApplied.current === token) return;
    const g = native.exercises.findIndex((g: any) => g.id === target.groupId);
    const q = native.exercises[g]?.items.findIndex(
      (q: any) => q.id === target.questionId,
    );
    if (g >= 0 && q >= 0) {
      setGroup(g);
      setItemIndex(q);
      setTab("practice");
      setComplete(false);
      targetApplied.current = token;
    }
  }, [native, target?.groupId, target?.questionId, lesson.id]);
  function recordProgress(p: any) {
    put("progress:" + lesson.id, { ...state, ...p });
    put("activity:" + new Date().toLocaleDateString("sv-SE"), true);
  }
  const groups = native?.exercises || [];
  const exercise = groups[group];
  const all = groups.flatMap((g: any) =>
    g.items.map((q: any) => ({ ...q, group: g.id })),
  );
  const keyFor = (q: any, g: string) =>
    "answer:native:" + lesson.id + ":" + g + ":" + q.id;
  const rawItems = exercise?.items || [];
  const items = reviewOnly
    ? rawItems.filter((q: any) => reviewIds.includes(q.id))
    : rawItems;
  const question = items[itemIndex];
  const answerKey = question ? keyFor(question, exercise.id) : "";
  const answer =
    drafts[answerKey] ??
    data["draft:" + answerKey] ??
    (compact ? {} : data[answerKey] || {});
  const answered = all.filter((q: any) =>
    ["good", "again", "partial"].includes(data[keyFor(q, q.group)]?.rating),
  ).length;
  const correct = all.filter(
    (q: any) => data[keyFor(q, q.group)]?.rating === "good",
  ).length;
  const currentChapter = native?.chapters[chapter];
  const isChecked = !!answer.rating;
  const isModel = answer.rating === "model";
  function speak(text: string) {
    setAudioNotice("");
    void playArabic(
      text,
      data.preferences?.audioRate || 0.8,
      lesson.id + ":" + exercise?.id + ":" + question?.id,
    ).catch(() =>
      setAudioNotice(
        "Nessuna voce araba installata sul dispositivo. Aggiungila nelle impostazioni vocali del sistema.",
      ),
    );
  }
  function submit(choice?: string) {
    if (!question || isChecked || gradingLock.current === answerKey) return;
    const text = choice ?? answer.text ?? "";
    const rating = evaluateAnswer(question, text);
    if (rating === "empty") return;
    gradingLock.current = answerKey;
    const automatic = rating !== "model";
    saveAnswer(answerKey, {
      ...answer,
      text,
      rating,
      automatic,
      expected: question.answers?.[0] || "",
      attempts: (data[answerKey]?.attempts || 0) + 1,
      checkedAt: new Date().toISOString(),
    });
    put("activity:" + new Date().toLocaleDateString("sv-SE"), true);
  }
  function nextQuestion() {
    gradingLock.current = "";
    if (onAdvance) {
      onAdvance();
      return;
    }
    setOrder([]);
    setShowFull(false);
    if (itemIndex + 1 < items.length) setItemIndex(itemIndex + 1);
    else setComplete(true);
  }
  function selectGroup(i: number) {
    gradingLock.current = "";
    setGroup(i);
    setItemIndex(0);
    setComplete(false);
    setOrder([]);
    setShowFull(false);
    setReviewOnly(false);
  }
  function openExercise(id: string) {
    const i = groups.findIndex((g: any) => g.id === id);
    if (i < 0) return;
    const read = [...new Set([...(state.read || []), chapter])];
    recordProgress({ step: chapter, read });
    selectGroup(i);
    setTab("practice");
    window.scrollTo(0, 0);
  }
  function appendLetter(a: string) {
    const el = box.current;
    const text = answer.text || "";
    const start = el?.selectionStart ?? text.length,
      end = el?.selectionEnd ?? text.length;
    saveAnswer(answerKey, {
      ...answer,
      text: text.slice(0, start) + a + text.slice(end),
      rating: undefined,
    });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + a.length, start + a.length);
    });
  }
  if (!native)
    return (
      <div className="empty panel">
        <h2>
          {error
            ? tr("Impossibile caricare la lezione")
            : tr("Prepariamo la tua lezione…")}
        </h2>
        <p>
          {error
            ? tr("Torna al percorso e riprova.")
            : tr("Spiegazioni, esempi ed esercizi, un passo alla volta.")}
        </p>
        <button className="secondary" onClick={onBack}>
          {tr("Torna al percorso")}
        </button>
      </div>
    );
  return (
    <div className={"native-course " + (compact ? "compact-course" : "")}>
      <button className="back native-back" onClick={onBack}>
        {tr("← Torna al percorso")}
      </button>
      <div className="heading lesson-heading">
        <div>
          <div className="eyebrow">
            {lesson.level} · {lesson.code} {tr(" · IL TUO CORSO INTERATTIVO")}
          </div>
          <h1>{native.title}</h1>
        </div>
        <span className="mastery-pill">
          {correct}{" "}
          {language === "en"
            ? "correct / self-confirmed · "
            : "corrette / autoconfermate · "}
          {answered}/{all.length} {tr(" svolte")}
        </span>
      </div>
      <div className="native-tabs">
        <button
          className={tab === "learn" ? "selected" : ""}
          onClick={() => setTab("learn")}
        >
          01 <span>{tr("Impara")}</span>
        </button>
        <button
          className={tab === "practice" ? "selected" : ""}
          onClick={() => setTab("practice")}
        >
          02 <span>{tr("Allenati")}</span>
          <small>{all.length}</small>
        </button>
        <button
          className={tab === "notes" ? "selected" : ""}
          onClick={() => setTab("notes")}
        >
          03 <span>{tr("I tuoi appunti")}</span>
        </button>
      </div>
      {tab === "learn" && (
        <div className="native-study-grid">
          <aside className="native-outline">
            <div className="eyebrow">{tr("PICCOLI PASSI, SOLIDE BASI")}</div>
            {native.chapters.map((c: any, i: number) => (
              <button
                key={i}
                className={chapter === i ? "selected" : ""}
                onClick={() => {
                  setChapter(i);
                  recordProgress({ step: i });
                }}
              >
                <span>
                  {(state.read || []).includes(i)
                    ? "✓"
                    : String(i + 1).padStart(2, "0")}
                </span>
                <Rich text={c.title} />
              </button>
            ))}
          </aside>
          <article className="native-article">
            <div className="article-top">
              <span>
                {tr("PASSAGGIO ")}
                {chapter + 1} {tr(" DI ")}
                {native.chapters.length}
              </span>
              <span>
                {Math.round(
                  ((state.read || []).length /
                    Math.max(1, native.chapters.length)) *
                    100,
                )}
                {tr("% letto")}
              </span>
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: ((chapter + 1) / native.chapters.length) * 100 + "%",
                }}
              />
            </div>
            <h2>
              <Rich text={currentChapter?.title} />
            </h2>
            <Blocks blocks={currentChapter?.blocks} onExercise={openExercise} />
            <ContextualVocabulary level={lesson.level} put={put} data={data} />
            <SpeakingPractice />
            <div className="native-article-actions">
              <button
                className="secondary"
                disabled={chapter === 0}
                onClick={() => {
                  setChapter(chapter - 1);
                  recordProgress({ step: chapter - 1 });
                  window.scrollTo(0, 0);
                }}
              >
                {tr("← Indietro")}
              </button>
              <button
                className="primary"
                onClick={() => {
                  const read = [...new Set([...(state.read || []), chapter])];
                  if (chapter + 1 < native.chapters.length) {
                    setChapter(chapter + 1);
                    recordProgress({ step: chapter + 1, read });
                  } else {
                    recordProgress({ read });
                    setTab("practice");
                  }
                  window.scrollTo(0, 0);
                }}
              >
                {chapter + 1 < native.chapters.length
                  ? tr("Ho capito, continua")
                  : tr("Passa agli esercizi")}{" "}
                →
              </button>
            </div>
          </article>
        </div>
      )}
      {tab === "practice" && (
        <>
          <div className="practice-bar">
            <div>
              <div className="eyebrow">{tr("IMPARARE FACENDO")}</div>
              <h2>{tr("Un esercizio alla volta.")}</h2>
            </div>
            <select
              disabled={compact}
              aria-label={tr("Scegli attività")}
              value={group}
              onChange={(e) => selectGroup(Number(e.target.value))}
            >
              {groups.map((g: any, i: number) => (
                <option key={i} value={i}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
          {groups.length === 0 ? (
            <div className="empty panel">
              <h2>{tr("Questa unità non ha esercizi numerati.")}</h2>
              <p>
                {tr(
                  "Trovi le attività e le consegne nei passaggi della lezione.",
                )}
              </p>
            </div>
          ) : complete || !question ? (
            <div className="session-finish panel">
              <span className="finish-mark">✓</span>
              <div className="eyebrow">{tr("ATTIVITÀ CONCLUSA")}</div>
              <h2>{tr("Un altro passo avanti.")}</h2>
              <p>
                {tr("Hai lavorato su «")}
                {exercise.title}».
              </p>
              <div className="finish-stats">
                <div>
                  <strong>
                    {
                      rawItems.filter(
                        (q: any) =>
                          data[keyFor(q, exercise.id)]?.rating === "good",
                      ).length
                    }
                  </strong>
                  <span>{tr("Corrette / confermate")}</span>
                </div>
                <div>
                  <strong>
                    {
                      rawItems.filter(
                        (q: any) =>
                          data[keyFor(q, exercise.id)]?.rating === "again",
                      ).length
                    }
                  </strong>
                  <span>{tr("Da rivedere")}</span>
                </div>
              </div>
              <div className="review-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setReviewIds(
                      rawItems
                        .filter(
                          (q: any) =>
                            data[keyFor(q, exercise.id)]?.rating !== "good",
                        )
                        .map((q: any) => q.id),
                    );
                    setReviewOnly(true);
                    setItemIndex(0);
                    setComplete(false);
                  }}
                  disabled={
                    !rawItems.some(
                      (q: any) =>
                        data[keyFor(q, exercise.id)]?.rating !== "good",
                    )
                  }
                >
                  {tr("Ripassa le risposte da rivedere")}
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    if (group + 1 < groups.length) selectGroup(group + 1);
                    else {
                      recordProgress({
                        done:
                          state.done ||
                          (answered === all.length &&
                            (state.read || []).length >=
                              native.chapters.length),
                        completionVersion: state.done
                          ? state.completionVersion
                          : 2,
                        completedAt: new Date().toISOString(),
                      });
                      onNext();
                    }
                  }}
                >
                  {group + 1 < groups.length
                    ? tr("Prossima attività →")
                    : tr("Concludi la lezione →")}
                </button>
              </div>
              <button className="back" onClick={() => selectGroup(group)}>
                {tr("Rivedi tutte le risposte")}
              </button>
            </div>
          ) : (
            <div className="question-shell">
              <div className="question-status">
                <span>
                  {reviewOnly ? tr("RIPASSO MIRATO") : exercise.title}
                </span>
                <span>
                  {itemIndex + 1} / {items.length}
                </span>
              </div>
              <div className="progress-track">
                <i
                  style={{
                    width: ((itemIndex + 1) / items.length) * 100 + "%",
                  }}
                />
              </div>
              <section className="question-card">
                <div className="question-mode">
                  {question.mode === "choice"
                    ? tr("SCEGLI LA RISPOSTA")
                    : question.mode === "order"
                      ? tr("RICOMPONI")
                      : question.mode === "input"
                        ? tr("SCRIVI LA RISPOSTA")
                        : tr("RISPONDI E CONFRONTA")}
                </div>
                <h2>
                  <Rich text={exercise.instruction || exercise.title} />
                </h2>
                {exercise.blocks?.length > 0 && (
                  <Blocks blocks={exercise.blocks} />
                )}
                {(question.prompt || !exercise.blocks?.length) && (
                  <div
                    className="question-prompt"
                    dir={arabicOnly(question.prompt) ? "rtl" : undefined}
                  >
                    <Rich
                      text={
                        question.prompt ||
                        exercise.instruction ||
                        exercise.title
                      }
                    />
                  </div>
                )}
                {question.prompt && /[\u0600-\u06ff]/.test(question.prompt) && (
                  <button
                    className="listen-button"
                    onClick={() => speak(question.prompt)}
                  >
                    {tr("◖ Ascolta con la voce del dispositivo")}
                  </button>
                )}
                {audioNotice && (
                  <p className="audio-notice" role="status">
                    {tr(audioNotice)}
                  </p>
                )}
                {question.mode === "choice" ? (
                  <div className="choice-options">
                    {question.options.map((o: any, i: number) => (
                      <button
                        key={o.id}
                        disabled={isChecked}
                        className={
                          (answer.text === o.id ? "picked " : "") +
                          (isChecked && question.answers.includes(o.id)
                            ? "right"
                            : "")
                        }
                        onClick={() => submit(o.id)}
                      >
                        <span>{String.fromCharCode(65 + i)}</span>
                        <Rich text={o.text} />
                        {isChecked && question.answers.includes(o.id) && (
                          <b>✓</b>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <label className="answer-label">
                      {tr("La tua risposta")}
                      <textarea
                        ref={box}
                        dir="auto"
                        value={answer.text || ""}
                        disabled={isChecked}
                        placeholder={
                          question.mode === "open"
                            ? tr(
                                "Scrivi la tua risposta. Poi confrontala con il modello…",
                              )
                            : tr("Scrivi qui…")
                        }
                        onChange={(e) =>
                          saveAnswer(answerKey, {
                            ...answer,
                            text: e.target.value,
                            rating: undefined,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.ctrlKey && e.key === "Enter") {
                            e.preventDefault();
                            submit();
                          }
                        }}
                      />
                    </label>
                    {question.mode === "order" && !isChecked && (
                      <div className="word-bank">
                        {question.tokens.map((t: string, i: number) => (
                          <button
                            key={i}
                            disabled={order.includes(i)}
                            onClick={() => {
                              const ids = [...order, i];
                              setOrder(ids);
                              saveAnswer(answerKey, {
                                ...answer,
                                text: ids
                                  .map((j) => question.tokens[j])
                                  .join(question.joiner ?? " "),
                                rating: undefined,
                              });
                            }}
                          >
                            {t}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setOrder([]);
                            saveAnswer(answerKey, {
                              ...answer,
                              text: "",
                              rating: undefined,
                            });
                          }}
                        >
                          {tr("Ricomincia ↺")}
                        </button>
                      </div>
                    )}
                    {!isChecked && (
                      <details className="keyboard-details">
                        <summary>{tr("Tastiera araba")}</summary>
                        <div className="arabic-keys" dir="rtl">
                          {"ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ء ة ى أ إ آ ئ ؤ َ ِ ُ ْ ّ ً ٍ ٌ"
                            .split(" ")
                            .map((a, i) => (
                              <button key={i} onClick={() => appendLetter(a)}>
                                {a}
                              </button>
                            ))}
                        </div>
                      </details>
                    )}
                    {question.strictMarks && (
                      <small className="strict-hint">
                        {tr(
                          "In questo esercizio contano anche vocali e sukūn.",
                        )}
                      </small>
                    )}
                  </>
                )}
                <button
                  className="context-link"
                  onClick={() => setShowContext(!showContext)}
                >
                  {showContext
                    ? tr("Chiudi il ripasso")
                    : tr("Hai bisogno della spiegazione? Ripassa la lezione")}
                </button>
                {showContext && (
                  <div className="question-context">
                    <select
                      aria-label={tr("Passaggio da ripassare")}
                      value={chapter}
                      onChange={(e) => setChapter(Number(e.target.value))}
                    >
                      {native.chapters.map((c: any, i: number) => (
                        <option key={i} value={i}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                    <Blocks blocks={native.chapters[chapter]?.blocks} />
                  </div>
                )}
                {isChecked && (
                  <div
                    className={
                      "feedback " +
                      (answer.rating === "good"
                        ? "success"
                        : answer.rating === "again"
                          ? "retry"
                          : "model")
                    }
                    role="status"
                  >
                    <div className="feedback-title">
                      {answer.rating === "good"
                        ? tr("✓ Ben fatto.")
                        : answer.rating === "again"
                          ? tr("Ci sei quasi: confrontiamo.")
                          : tr("Confronta il tuo ragionamento.")}
                    </div>
                    {question.mode === "open" && (
                      <p>
                        {tr(
                          "Questa risposta richiede valutazione del contenuto. Usa il modello per controllare significato e forma.",
                        )}
                      </p>
                    )}
                    {question.model ? (
                      <>
                        <span className="feedback-label">
                          {question.mode === "open"
                            ? tr("RISPOSTA DI RIFERIMENTO")
                            : tr("SOLUZIONE ATTESA")}
                        </span>
                        <div
                          className="model-answer"
                          dir={arabicOnly(question.model) ? "rtl" : undefined}
                        >
                          <Rich
                            text={
                              question.mode === "choice"
                                ? question.options.find((o: any) =>
                                    question.answers.includes(o.id),
                                  )?.text
                                : question.answers?.[0] || question.model
                            }
                          />
                        </div>
                      </>
                    ) : exercise.solutionBlocks?.length ? (
                      <>
                        <span className="feedback-label">
                          {tr("SOLUZIONE DELL’ATTIVITÀ")}
                        </span>
                        <div className="activity-solution">
                          <Blocks blocks={exercise.solutionBlocks} />
                        </div>
                      </>
                    ) : (
                      <p>
                        {tr(
                          "La soluzione non è indicizzata separatamente. Apri il commento completo dell’unità qui sotto.",
                        )}
                      </p>
                    )}
                    {question.model && exercise.solutionBlocks?.length > 0 ? (
                      <>
                        <button
                          className="context-link"
                          onClick={() => setShowFull(!showFull)}
                        >
                          {showFull
                            ? tr("Chiudi il commento")
                            : tr(
                                "Commento completo dell’attività (contiene altre soluzioni)",
                              )}
                        </button>
                        {showFull && (
                          <div className="activity-solution">
                            <Blocks blocks={exercise.solutionBlocks} />
                          </div>
                        )}
                      </>
                    ) : (
                      question.explanation &&
                      question.explanation !== question.model &&
                      !exercise.solutionBlocks?.length && (
                        <>
                          <button
                            className="context-link"
                            onClick={() => setShowFull(!showFull)}
                          >
                            {showFull
                              ? tr("Chiudi il commento")
                              : tr(
                                  "Commento completo dell’attività (contiene altre soluzioni)",
                                )}
                          </button>
                          {(showFull ||
                            (question.explanation.length < 450 &&
                              !/(?:[a-z]\)|\d+\s+[a-z]\b)/.test(
                                question.explanation,
                              ))) && (
                            <div className="correction-text">
                              <Rich text={question.explanation} />
                            </div>
                          )}
                        </>
                      )
                    )}
                    {!question.model && !exercise.solutionBlocks?.length && (
                      <details>
                        <summary>{tr("Commento completo dell’unità")}</summary>
                        <Blocks blocks={native.solutionBlocks} />
                      </details>
                    )}
                    {isModel && (
                      <div className="self-grade">
                        <span>{tr("Come è andata?")}</span>
                        <button
                          className="secondary"
                          onClick={() =>
                            saveAnswer(answerKey, {
                              ...answer,
                              rating: "again",
                              automatic: false,
                            })
                          }
                        >
                          {tr("Da rivedere")}
                        </button>
                        <button
                          className="primary"
                          onClick={() =>
                            saveAnswer(answerKey, {
                              ...answer,
                              rating: "good",
                              automatic: false,
                            })
                          }
                        >
                          {tr("Risposta equivalente")}
                        </button>
                      </div>
                    )}
                    {question.mode !== "open" && answer.rating === "again" && (
                      <small>
                        {tr(
                          "Il controllo automatico confronta le forme previste. Una variante non presente nel modello può richiedere una verifica personale.",
                        )}
                      </small>
                    )}
                    <button className="context-link" onClick={onFlashcard}>
                      {tr("+ Trasforma questo punto in una flashcard")}
                    </button>
                  </div>
                )}
              </section>
              <div className="question-footer">
                <button
                  className="back"
                  disabled={compact}
                  onClick={() => {
                    if (itemIndex > 0) {
                      setItemIndex(itemIndex - 1);
                      setOrder([]);
                      setShowFull(false);
                    } else setTab("learn");
                  }}
                >
                  ← {itemIndex ? tr("Precedente") : tr("Spiegazione")}
                </button>
                {isChecked ? (
                  <div className="answer-actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        gradingLock.current = "";
                        saveAnswer(answerKey, {
                          ...answer,
                          rating: undefined,
                          text: "",
                        });
                        setOrder([]);
                      }}
                    >
                      {tr("Riprova")}
                    </button>
                    <button
                      className="primary"
                      disabled={isModel}
                      onClick={nextQuestion}
                    >
                      {tr("Continua →")}
                    </button>
                  </div>
                ) : (
                  <button
                    className="primary"
                    disabled={
                      question.mode === "choice" || !answer.text?.trim()
                    }
                    onClick={() => submit()}
                  >
                    {question.mode === "open"
                      ? tr("Mostra la correzione")
                      : tr("Controlla")}{" "}
                    ✓
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {tab === "notes" && (
        <div className="panel notes">
          <div className="eyebrow">{tr("METTI A FUOCO QUELLO CHE IMPARI")}</div>
          <h2>{tr("Il tuo quaderno.")}</h2>
          <p>
            {tr("Regole, esempi e dubbi: restano collegati a questa lezione.")}
          </p>
          <textarea
            dir="auto"
            aria-label={tr("Appunti della lezione")}
            value={data["note:" + lesson.id] || ""}
            onChange={(e) => put("note:" + lesson.id, e.target.value)}
            placeholder={tr("Che cosa vuoi ricordare?")}
          />
        </div>
      )}
    </div>
  );
}
