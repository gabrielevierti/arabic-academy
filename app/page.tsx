import {tr,useLanguage} from "../lib/i18n";
("use client");
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
const MicroLessons = lazy(() => import("./micro-lessons"));
const BookLibrary = lazy(() => import("./book-library"));
import OfflineStatus, { OfflineSettings } from "./offline-status";
import Navigation,{CourseNavigation} from "./navigation";
import CourseHub from "./course-hub";
import Preferences, { applyPreferences } from "./preferences";
import { useDialogFocus } from "../lib/use-dialog-focus";
import CourseIndex from "./course-index";
import { routeHash, parseRoute } from "../lib/routing";
import { useProgressStore } from "../lib/use-progress-store";
import BackupManager from "./backup-manager";

const Alphabet = lazy(() => import("./alphabet"));
const Progress = lazy(() => import("./progress"));
const GuidedSession = lazy(() => import("./guided-session"));
import { PracticeHub, ErrorReview } from "./learning-hub";
import { nextReview } from "../lib/learning";
import { useStudyTime } from "../lib/use-study-time";
import metadata from "../data/study-metadata.json";
const NativeCourse = lazy(() => import("./native-course"));
const NativeResource = lazy(() =>
  import("./native-course").then((m) => ({ default: m.NativeResource })),
);

const levels = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
const names = [
  "Alfabetizzazione",
  "Le fondamenta",
  "Autonomia elementare",
  "Competenza intermedia",
  "Competenza operativa",
  "Competenza professionale",
  "Padronanza",
];
const day = () => new Date().toLocaleDateString("sv-SE");
const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    home: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    book: (
      <>
        <path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Z" />
        <path d="M12 5v15" />
      </>
    ),
    repeat: (
      <>
        <path d="M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6M4 17a9 9 0 0 0 15 2l3-3m0 6v-6h-6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v18h18M9 16v-5m5 5V7m5 9V3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L20 5" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p[name] || p.book}
    </svg>
  );
}
export default function App() {
  return (
    <CourseIndex>
      {(course) => (
        <Suspense fallback={<p role="status">Caricamento / Loading…</p>}>
          <Academy course={course} />
        </Suspense>
      )}
    </CourseIndex>
  );
}
function Academy({ course }: { course: typeof import("../data/course.json") }) {
  const language = useLanguage();

  const t = (it: string, en: string) => (language === "en" ? en : it);
  const [entryTab, setEntryTab] = useState("learn"),
    [sessionId, setSessionId] = useState(0);
  const [resource, setResource] = useState("");
  const [view, setViewState] = useState("home"),
    [level, setLevel] = useState("A0"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [modal, setModal] = useState(""),
    [notice, setNotice] = useState(""),
    [flip, setFlip] = useState(false),
    [reviewIndex, setReviewIndex] = useState(0),
    [quizAnswer, setQuizAnswer] = useState(""),
    [quizResult, setQuizResult] = useState("");
  const {
    data,
    dataRef,
    loaded,
    sync,
    error: storageError,
    put,
    flush,
    load,
    importData,
  } = useProgressStore();
  useStudyTime(loaded && ["lesson", "alphabet", "micro", "review", "flashcards"].includes(view), data, put);
  const custom = Object.entries(data)
    .filter(([k, v]) => k.startsWith("lesson:") && v)
    .map(([, v]) => v);
  const lessons: any[] = [...course.lessons, ...custom];
  const current =
    lessons.find(
      (l) => l.id === data.last && !l.custom && !data["progress:" + l.id]?.done,
    ) ||
    lessons.find(
      (l) => (metadata as any)[l.id]?.core && !data["progress:" + l.id]?.done,
    ) ||
    lessons.find((l) => !l.custom) ||
    lessons[0];
  function startSession(review = false) {
    setSessionId((n) => n + 1);
    setView(review ? "error-session" : "session");
    window.scrollTo(0, 0);
  }
  const cards = Object.entries(data)
    .filter(([k, v]) => k.startsWith("card:") && v)
    .map(([key, v]) => ({ ...v, key }));
  const due = cards.filter((c) => !c.due || c.due <= day());
  const customExercises = Object.entries(data)
    .filter(([k, v]) => k.startsWith("quiz:") && v)
    .map(([key, v]) => ({ ...v, key }));
  function openLesson(l: any, mode = "learn") {
    setEntryTab(mode);
    setSelected(l);
    setViewState("lesson");
    history.pushState(null, "", routeHash({ view: "lesson", id: l.id }));
    put("last", l.id);
    put("progress:" + l.id, {
      ...dataRef.current["progress:" + l.id],
      openedAt:
        dataRef.current["progress:" + l.id]?.openedAt ||
        new Date().toISOString(),
    });
    put("activity:" + day(), true);
    window.scrollTo(0, 0);
  }
  function progress(p: any) {
    put("progress:" + selected.id, {
      ...dataRef.current["progress:" + selected.id],
      ...p,
    });
    put("activity:" + day(), true);
  }
  const activeCard = due[reviewIndex % due.length];
  function review(rating: string) {
    if (!activeCard) return;
    const previous = activeCard.schedule || {
      due: activeCard.due,
      interval: activeCard.interval,
      successes: 0,
    };
    const schedule = nextReview(previous, rating);
    put(activeCard.key, {
      ...activeCard,
      schedule,
      interval: schedule.interval,
      due: schedule.due,
      reviews: (activeCard.reviews || 0) + 1,
    });
    put("activity:" + day(), true);
    setFlip(false);
    setReviewIndex(0);
  }
  function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      id = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
        n.toString(16).padStart(8, "0"),
      ).join("");
    if (modal === "card")
      put("card:" + id, {
        front: f.get("front"),
        back: f.get("back"),
        level: f.get("level"),
        due: day(),
        interval: 0,
      });
    if (modal === "lesson")
      put("lesson:" + id, {
        id: "custom-" + id,
        code: "PERSONALE",
        level: f.get("level"),
        title: f.get("title"),
        content: f.get("content"),
        exercises: [],
        sections: [],
        custom: true,
      });
    if (modal === "quiz")
      put("quiz:" + id, {
        question: f.get("front"),
        answer: f.get("back"),
        level: f.get("level"),
      });
    setModal("");
    setNotice("Contenuto aggiunto al tuo corso.");
  }
  useDialogFocus(!!modal, () => setModal(""));
  useEffect(() => applyPreferences(data.preferences || {}), [data.preferences]);
  const routeData = useRef({ lessons, loaded });
  routeData.current = { lessons, loaded };
  function setView(v: string) {
    if(v==='home')v='course';
    const hash = routeHash({ view: v });
    if (location.hash !== hash) location.hash = hash;
    else setViewState(v);
  }
  useEffect(() => {
    const update = () => {
      const r = parseRoute(location.hash);
      if (r.view === "lesson") {
        const l = routeData.current.lessons.find((l) => l.id === r.id);
        if (l) {
          setSelected(l);
        } else if (routeData.current.loaded) {
          setViewState("missing");
          return;
        }
      }
      if (r.view === "resource") setResource(r.id || "");
      if (r.level && levels.includes(r.level)) setLevel(r.level);
      setViewState(r.view==='home'?'course':r.view);
      setSearch("");
      requestAnimationFrame(() => {
        document.getElementById("main-content")?.focus();
        window.scrollTo(0, 0);
      });
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [course, loaded]);
  const headerTitle: Record<string, string> = {
    alphabet: t("Alfabeto", "Alphabet"),
    session: t(`Studia ${data.goal||15} minuti`, `Study for ${data.goal||15} minutes`),
    micro: t("Micro-lezioni A0", "A0 micro-lessons"),
    "error-session": t("Ripasso degli errori", "Mistake review"),
    home: tr("Il mio spazio"),
    course: "Il tuo corso",
    review: "Ripasso e correzioni",
    flashcards: "Flashcard",
    practice: tr("Esercizi"),
    stats: tr("I miei progressi"),
    library: tr("Biblioteca"),
    settings: tr("Impostazioni"),
    resource: tr("Approfondimenti"),
    lesson: selected?.code || tr("Lezione"),
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("home");
          }}
        >
          <span className="brand-mark">ع</span>
          <span>
            Arabic<span className="brand-sub">ACADEMY</span>
          </span>
        </a>
        <div className="side-label">{tr("IL TUO APPRENDIMENTO")}</div>
        <Navigation view={view} navigate={setView} />
        <div className="sidebar-bottom">
          <button className="nav" onClick={() => setView("settings")}>
            <Icon name="settings" />
            {tr("Impostazioni")}
          </button>
        </div>
      </aside>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        {t("Vai al contenuto", "Skip to content")}
      </a>
      <main>
        <header className="topbar">

          <span>
            {tr("La tua academy ")}
            <span className="crumb">/</span> <b>{headerTitle[view]}</b>
          </span>
          <button
            className={"sync " + (sync.includes("non") ? "error" : "")}
            onClick={() =>
              loaded ? void flush().catch(() => {}) : void load()
            }
          >
            <span className="dot" />
            {tr(sync)}
          </button>
        </header>
        <Navigation view={view} navigate={setView} mobile />
        <div className="content" id="main-content" tabIndex={-1}>
          <OfflineStatus flush={flush} />
          <CourseNavigation view={view} navigate={setView}/>
          {view === "missing" && (
            <div className="panel">
              <h1>{t("Pagina non trovata", "Page not found")}</h1>
              <button className="primary" onClick={() => setView("course")}>
                {t("Apri il percorso", "Open course")}
              </button>
            </div>
          )}
          {storageError && (
            <div className="notice" role="alert">
              {storageError}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {tr(notice)}
              <button
                onClick={() => setNotice("")}
                aria-label={tr("Chiudi avviso")}
              >
                ×
              </button>
            </div>
          )}
          {view === "micro" && loaded && (
            <MicroLessons data={data} put={put} lessons={lessons} />
          )}
          {view === "alphabet" && loaded && <Alphabet data={data} put={put} />}
          {["session", "error-session"].includes(view) && loaded && (
            <GuidedSession
              key={sessionId}
              onRestart={() => startSession()}
              review={view === "error-session"}
              data={data}
              put={put}
              lessons={lessons}
              current={current}
              onExit={() => setView("home")}
              onFlashcard={() => setModal("card")}
            />
          )}
          {view === "course" && (
            <>
              <CourseHub data={data} lessons={lessons} current={current} loaded={loaded} onResume={()=>openLesson(current)} onStudy={()=>startSession()} onPractice={()=>setView('practice')} onReview={()=>setView('review')}/>
              <div className="course-tools">
              <button className="secondary" onClick={() => setView("alphabet")}>
                {t("Alfabeto interattivo", "Interactive alphabet")}
              </button>
              <button className="primary" onClick={() => setView("micro")}>
                {t("Micro-lezioni A0", "A0 micro-lessons")}
              </button>
              </div><div className="heading spaced">
                <div>
                  <div className="eyebrow">LE LEZIONI</div>
                  <h2>Il percorso, dalle basi in avanti.</h2>
                  <p>
                    {tr(
                      "Segui l’ordine del corso oppure scegli cosa approfondire.",
                    )}
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={!loaded}
                  onClick={() => setModal("lesson")}
                >
                  <Icon name="plus" />
                  {tr("Nuova lezione")}
                </button>
              </div>
              <div className="filters">
                <div className="tabs">
                  {levels.map((l) => (
                    <button
                      className={l === level ? "chosen" : ""}
                      key={l}
                      onClick={() => {
                        setLevel(l);
                        history.replaceState(
                          null,
                          "",
                          routeHash({ view: "course", level: l }),
                        );
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Icon name="search" />
                  <input
                    placeholder={tr("Cerca una lezione…")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="section-heading">
                <h2>
                  {level} · {tr(names[levels.indexOf(level)])}
                </h2>
                <span className="muted">
                  {lessons.filter((l) => l.level === level).length}{" "}
                  {tr(" lezioni")}
                </span>
              </div>
              <div className="lesson-list">
                {lessons
                  .filter(
                    (l) =>
                      l.level === level &&
                      (l.title + " " + l.code)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((l, i) => (
                    <button
                      className="lesson-row"
                      key={l.id}
                      disabled={!loaded}
                      onClick={() => openLesson(l)}
                    >
                      <span
                        className={
                          "lesson-number " +
                          (data["progress:" + l.id]?.done ? "complete" : "")
                        }
                      >
                        {data["progress:" + l.id]?.done ? (
                          <Icon name="check" />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <small>
                          {l.code}
                          {l.track &&
                          !["L0", "A1", "A2", "B1", "B2"].includes(l.track)
                            ? tr(" · Traccia complementare")
                            : ""}
                        </small>
                        <h3>{l.title}</h3>
                        <p>
                          {l.custom
                            ? tr("Contenuto personale")
                            : `${l.nativeChapters || 0} ${language === "it" ? "passaggi" : "steps"} · ${l.nativeItems || 0} ${language === "it" ? "domande" : "questions"}`}
                        </p>
                      </div>
                      <span className="lesson-state">
                        {data["progress:" + l.id]?.done
                          ? tr("Completata")
                          : data["progress:" + l.id]
                            ? tr("In corso")
                            : tr("Da esplorare")}
                      </span>
                      <Icon name="arrow" />
                    </button>
                  ))}
              </div>
              {!lessons.some((l) => l.level === level) && (
                <div className="empty panel">
                  <span className="large-arabic">ق</span>
                  <h2>{tr("Il prossimo capitolo è tuo.")}</h2>
                  <p>
                    {tr("I volumi ")}
                    {level} {tr(" non sono ancora stati aggiunti.")}
                    <br />
                    {tr(
                      "Intanto puoi creare lezioni ed esercizi personali per questo livello.",
                    )}
                  </p>
                  <button
                    className="primary"
                    disabled={!loaded}
                    onClick={() => setModal("lesson")}
                  >
                    {tr("Crea una lezione ")}
                    {level}
                  </button>
                </div>
              )}
            </>
          )}
          {view === "lesson" && selected && !selected.custom && (
            <NativeCourse
              entryTab={entryTab}
              key={selected.id + entryTab}
              lesson={selected}
              data={data}
              put={put}
              onBack={() => {
                setView("course");
                setLevel(selected.level);
              }}
              onNext={() => {
                const next =
                  lessons[lessons.findIndex((l) => l.id === selected.id) + 1];
                if (next) openLesson(next);
                else setView("stats");
              }}
              onFlashcard={() => setModal("card")}
            />
          )}
          {view === "lesson" && selected?.custom && (
            <>
              <button className="back" onClick={() => setView("course")}>
                {tr("← Torna al percorso")}
              </button>
              <div className="heading">
                <h1>{selected.title}</h1>
                <button
                  className="primary"
                  onClick={() =>
                    progress({ done: !data["progress:" + selected.id]?.done })
                  }
                >
                  {data["progress:" + selected.id]?.done
                    ? tr("Completata · Annulla")
                    : tr("Segna completata")}
                </button>
              </div>
              <article className="panel custom-text">
                {selected.content}
              </article>
              <div className="panel notes spaced">
                <h2>{tr("Appunti")}</h2>
                <textarea
                  aria-label={tr("Appunti della lezione")}
                  value={data["note:" + selected.id] || ""}
                  onChange={(e) => put("note:" + selected.id, e.target.value)}
                />
              </div>
            </>
          )}
          {view === "resource" && (
            <NativeResource
              key={resource}
              id={resource}
              onBack={() => setView("library")}
            />
          )}
          {(view === "review" || view === "flashcards") && loaded && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    {t("IL SAPERE SI CONSOLIDA", "MAKE KNOWLEDGE STICK")}
                  </div>
                  <h1>
                    {t(
                      view === "flashcards" ? "Le tue flashcard." : "Ripassa, un passo alla volta.",
                      "Review, one step at a time.",
                    )}
                  </h1>
                  <p>
                    {t(
                      "Riprendi gli errori e ritrova le parole del tuo mazzo.",
                      "Revisit mistakes and recall the words in your deck.",
                    )}
                  </p>
                </div>
              </div>
              {view === "review" && <ErrorReview
                data={data}
                lessons={lessons}
                onStart={() => startSession(true)}
              />}
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    {t("IL TUO MAZZO PERSONALE", "YOUR PERSONAL DECK")}
                  </div>
                  <h2>{t("Le tue flashcard", "Your flashcards")}</h2>
                  <p>
                    {due.length} {tr(" flashcard da ripassare oggi · ")}
                    {cards.length} {tr(" nel tuo mazzo")}
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={!loaded}
                  onClick={() => setModal("card")}
                >
                  <Icon name="plus" />
                  {tr("Nuova flashcard")}
                </button>
              </div>
              {activeCard ? (
                <div className="review-wrap">
                  <div
                    className="flashcard"
                    onClick={() => setFlip(!flip)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setFlip(!flip);
                      }
                    }}
                  >
                    <span className="eyebrow">
                      {activeCard.level} ·{" "}
                      {flip ? tr("RISPOSTA") : tr("PROVA A RICORDARE")}
                    </span>
                    <div dir="auto">
                      {flip ? activeCard.back : activeCard.front}
                    </div>
                    <small>
                      {flip
                        ? tr("Come è andata?")
                        : tr("Tocca per girare la carta ↻")}
                    </small>
                  </div>
                  {flip && (
                    <div className="review-actions">
                      <button
                        className="secondary"
                        onClick={() => review("again")}
                      >
                        {t("Da rivedere", "Again")}
                      </button>
                      <button
                        className="primary"
                        onClick={() => review("good")}
                      >
                        {t("Ricordata", "Good")}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => review("hard")}
                      >
                        {t("Difficile", "Hard")}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => review("easy")}
                      >
                        {t("Facile", "Easy")}
                      </button>
                    </div>
                  )}
                  <p className="muted centered">
                    {tr("Le carte ricordate tornano a intervalli più lunghi.")}
                  </p>
                </div>
              ) : (
                <div className="empty panel">
                  <Icon name="repeat" size={40} />
                  <h2>
                    {cards.length
                      ? tr("Sei in pari per oggi.")
                      : tr("Le parole diventano tue, ripassandole.")}
                  </h2>
                  <p>
                    {cards.length
                      ? tr("Le prossime carte appariranno alla data prevista.")
                      : tr(
                          "Crea il tuo primo mazzo con parole, regole o frasi delle lezioni.",
                        )}
                  </p>
                  <button
                    className="primary"
                    disabled={!loaded}
                    onClick={() => setModal("card")}
                  >
                    {tr("Aggiungi una flashcard")}
                  </button>
                </div>
              )}
              {cards.length > 0 && (
                <>
                  <h2 className="spaced">{tr("Il tuo mazzo")}</h2>
                  <div className="lesson-list">
                    {cards.map((c) => (
                      <div className="deck-row" key={c.key}>
                        <b dir="auto">{c.front}</b>
                        <span dir="auto">{c.back}</span>
                        <small>
                          {c.level} {tr(" · prossimo ripasso ")}
                          {c.due}
                        </small>
                        <button
                          className="back"
                          onClick={() => {
                            if (confirm(tr("Eliminare questa flashcard?")))
                              put(c.key, null);
                          }}
                        >
                          {tr("Elimina")}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {view === "practice" && loaded && (
            <>
              <PracticeHub
                lessons={lessons}
                data={data}
                onOpen={(l) => openLesson(l, "practice")}
                onReview={() => setView("review")}
              />
              {customExercises.length > 0 && (
                <details className="personal-exercises panel spaced">
                  <summary>
                    {t(
                      "I tuoi esercizi personali salvati",
                      "Your saved personal exercises",
                    )}{" "}
                    · {customExercises.length}
                  </summary>
                  {customExercises.map((q) => (
                    <div className="panel quiz" key={q.key}>
                      <span className="eyebrow">
                        {q.level} {tr(" · RISPOSTA BREVE")}
                      </span>
                      <h2 dir="auto">{q.question}</h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const a = String(
                            new FormData(e.currentTarget).get("answer"),
                          );
                          const ok = normalize(a) === normalize(q.answer);
                          put("answer:" + q.key, {
                            text: a,
                            rating: ok ? "good" : "again",
                          });
                          put("activity:" + day(), true);
                          setQuizResult(q.key);
                          setQuizAnswer(
                            ok
                              ? "Risposta corretta!"
                              : "La risposta non coincide con quella attesa: " +
                                  q.answer,
                          );
                        }}
                      >
                        <input
                          name="answer"
                          dir="auto"
                          aria-label={tr("La tua risposta")}
                          placeholder={tr("La tua risposta…")}
                          required
                        />
                        <button className="primary">{tr("Verifica")}</button>
                      </form>
                      {quizResult === q.key && (
                        <p role="status" className="quiz-result">
                          {tr(quizAnswer)}
                        </p>
                      )}
                      <small>
                        {tr(
                          "Confronto esatto, ignorando maiuscole, spazi ripetuti e vocali brevi arabe. Le varianti equivalenti non vengono riconosciute automaticamente.",
                        )}
                      </small>
                      <button
                        className="back"
                        onClick={() => {
                          if (confirm(tr("Eliminare questo esercizio?")))
                            put(q.key, null);
                        }}
                      >
                        {tr("Elimina esercizio")}
                      </button>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
          {view === "stats" && loaded && (
            <Progress
              data={data}
              lessons={lessons}
              onStudy={() => startSession()}
            />
          )}
          {view === "library" && <BookLibrary books={course.books} lessons={lessons} data={data} put={put} onLesson={id=>{const l=lessons.find(l=>l.id===id);if(l)openLesson(l)}} onResource={id=>{setResource(id);setViewState('resource');location.hash=routeHash({view:'resource',id});window.scrollTo(0,0)}}/>}
          {view === "settings" && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">{tr("IL CORSO È TUO")}</div>
                  <h1>{tr("Organizza il tuo spazio.")}</h1>
                </div>
              </div>
              <div className="panel settings">
                <h2>{tr("Progressi e backup")}</h2>
                <p>
                  {tr(
                    "Lezioni completate, risposte, appunti e contenuti personali vengono salvati solo in questo browser e su questo dispositivo. Cancellando i dati del browser perderai i progressi: esporta regolarmente un backup. Non è prevista sincronizzazione automatica tra dispositivi. Puoi esportare una copia e ripristinarla.",
                  )}
                </p>
                <OfflineSettings />
                <Preferences data={data} put={put} />
                <BackupManager
                  data={data}
                  disabled={!loaded}
                  importData={importData}
                />
                <h2 className="spaced">{tr("Il tuo obiettivo quotidiano")}</h2>
                <select
                  aria-label={tr("Minuti al giorno")}
                  value={data.goal || 15}
                  disabled={!loaded}
                  onChange={(e) => put("goal", Number(e.target.value))}
                >
                  {[10, 15, 20, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} {tr(" minuti al giorno")}
                    </option>
                  ))}
                </select>
                <p className="muted">
                  {t(
                    "Il tempo attivo viene misurato durante lo studio, con scheda visibile. Dopo un minuto senza interazioni il conteggio si ferma. Le ore precedenti a questo aggiornamento non sono disponibili.",
                    "Active time is tracked during study while the tab is visible. Tracking stops after a minute without interaction. Time from before this update is unavailable.",
                  )}
                </p>
                <h2 className="spaced">{tr("Come funziona il corso")}</h2>
                <p>
                  {tr(
                    "Il corso è organizzato in spiegazioni native, tabelle, esempi e attività interattive. Le risposte vincolate hanno verifica automatica; le risposte aperte mostrano un modello commentato con autovalutazione. I progressi precedenti restano conservati.",
                  )}
                </p>
                <p>
                  {tr(
                    "Il pulsante di ascolto usa una voce araba installata sul dispositivo, quando disponibile. Gli script di ascolto sono testo nativo: non sono presenti registrazioni di madrelingua.",
                  )}
                </p>
              </div>
            </>
          )}
        </div>
        <footer>
          ARABIC ACADEMY{" "}
          <span>{tr("Il tuo percorso. Una parola alla volta.")}</span>
        </footer>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal("");
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="close"
              aria-label={tr("Chiudi")}
              onClick={() => setModal("")}
            >
              ×
            </button>
            <div className="eyebrow">{tr("PERSONALIZZA IL TUO CORSO")}</div>
            <h2 id="modal-title">
              {modal === "card"
                ? tr("Una nuova flashcard")
                : modal === "lesson"
                  ? tr("Una lezione tutta tua")
                  : tr("Un nuovo esercizio")}
            </h2>
            <form onSubmit={submitForm}>
              <label>
                {tr("Livello")}
                <select name="level" defaultValue={selected?.level || level}>
                  {levels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              {modal === "lesson" ? (
                <>
                  <label>
                    {tr("Titolo")}
                    <input
                      name="title"
                      required
                      maxLength={200}
                      placeholder={tr("Che cosa vuoi imparare?")}
                    />
                  </label>
                  <label>
                    {tr("Contenuto della lezione")}
                    <textarea
                      name="content"
                      dir="auto"
                      required
                      maxLength={50000}
                      placeholder={tr("Spiegazioni, esempi e riferimenti…")}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    {modal === "card"
                      ? tr("Fronte · parola o domanda")
                      : tr("Domanda")}
                    <textarea
                      name="front"
                      dir="auto"
                      required
                      maxLength={3000}
                    />
                  </label>
                  <label>
                    {modal === "card"
                      ? tr("Retro · significato o risposta")
                      : tr("Risposta attesa")}
                    <textarea
                      name="back"
                      dir="auto"
                      required
                      maxLength={3000}
                    />
                  </label>
                </>
              )}
              <button className="primary full" type="submit">
                {tr("Aggiungi al mio corso ")}
                <Icon name="plus" />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
