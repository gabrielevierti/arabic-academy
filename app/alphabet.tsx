import AlphabetAssessment from "./alphabet-assessment";
import Handwriting from "./handwriting";
import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { localDay } from "../lib/learning";
// Isolated letters and joining forms; the six right-joining letters have no
// distinct initial/medial joined forms. Tatweel makes the connection visible.
export const letters = [
  ["ا", "alif", "ā", "أَلِف", "بَاب", "porta", "door"],
  ["ب", "bāʾ", "b", "بَاء", "بَيْت", "casa", "house"],
  ["ت", "tāʾ", "t", "تَاء", "تَمْر", "datteri", "dates"],
  ["ث", "ṯāʾ", "θ", "ثَاء", "ثَلَاثَة", "tre", "three"],
  ["ج", "ǧīm", "dʒ", "جِيم", "جَمَل", "cammello", "camel"],
  ["ح", "ḥāʾ", "ħ", "حَاء", "حَلِيب", "latte", "milk"],
  ["خ", "ḫāʾ", "x", "خَاء", "خُبْز", "pane", "bread"],
  ["د", "dāl", "d", "دَال", "دَرْس", "lezione", "lesson"],
  ["ذ", "ḏāl", "ð", "ذَال", "ذَهَب", "oro", "gold"],
  ["ر", "rāʾ", "r", "رَاء", "رَجُل", "uomo", "man"],
  ["ز", "zāy", "z", "زَاي", "زَيْت", "olio", "oil"],
  ["س", "sīn", "s", "سِين", "سَمَك", "pesce", "fish"],
  ["ش", "šīn", "ʃ", "شِين", "شَمْس", "sole", "sun"],
  ["ص", "ṣād", "sˤ", "صَاد", "صَبَاح", "mattina", "morning"],
  ["ض", "ḍād", "dˤ", "ضَاد", "ضَيْف", "ospite", "guest"],
  ["ط", "ṭāʾ", "tˤ", "طَاء", "طَالِب", "studente", "student"],
  ["ظ", "ẓāʾ", "ðˤ", "ظَاء", "ظِلّ", "ombra", "shade"],
  ["ع", "ʿayn", "ʕ", "عَيْن", "عَيْن", "occhio", "eye"],
  ["غ", "ġayn", "ɣ", "غَيْن", "غُرْفَة", "stanza", "room"],
  ["ف", "fāʾ", "f", "فَاء", "فَم", "bocca", "mouth"],
  ["ق", "qāf", "q", "قَاف", "قَلَم", "penna", "pen"],
  ["ك", "kāf", "k", "كَاف", "كِتَاب", "libro", "book"],
  ["ل", "lām", "l", "لَام", "لَيْل", "notte", "night"],
  ["م", "mīm", "m", "مِيم", "مَاء", "acqua", "water"],
  ["ن", "nūn", "n", "نُون", "نُور", "luce", "light"],
  ["ه", "hāʾ", "h", "هَاء", "هِلَال", "luna crescente", "crescent moon"],
  ["و", "wāw", "w / ū", "وَاو", "وَرْد", "rose", "roses"],
  ["ي", "yāʾ", "j / ī", "يَاء", "يَد", "mano", "hand"],
];
export const nonJoining = "ادذرزو";
function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export default function Alphabet({
  data,
  put,
}: {
  data: Record<string, any>;
  put: (k: string, v: any) => void;
}) {
  const en = useLanguage() === "en",
    t = (it: string, eng: string) => (en ? eng : it);
  const [index, setIndex] = useState(0),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [notice, setNotice] = useState(""),
    [slow, setSlow] = useState(false),
    [filter, setFilter] = useState(false);
  const [quizMode, setQuizMode] = useState("names");
  const dotInfo: Record<string, [number, string]> = {
    ا: [0, ""],
    ب: [1, "below"],
    ت: [2, "above"],
    ث: [3, "above"],
    ج: [1, "below"],
    ح: [0, ""],
    خ: [1, "above"],
    د: [0, ""],
    ذ: [1, "above"],
    ر: [0, ""],
    ز: [1, "above"],
    س: [0, ""],
    ش: [3, "above"],
    ص: [0, ""],
    ض: [1, "above"],
    ط: [0, ""],
    ظ: [1, "above"],
    ع: [0, ""],
    غ: [1, "above"],
    ف: [1, "above"],
    ق: [2, "above"],
    ك: [0, ""],
    ل: [0, ""],
    م: [0, ""],
    ن: [1, "above"],
    ه: [0, ""],
    و: [0, ""],
    ي: [2, "below"],
  };
  const [quiz, setQuiz] = useState<number[]>([]),
    [step, setStep] = useState(0),
    [options, setOptions] = useState<number[]>([]),
    [picked, setPicked] = useState<number | null>(null),
    [score, setScore] = useState(0);
  const l = letters[index],
    joined = !nonJoining.includes(l[0]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const f = () => setVoices(speechSynthesis.getVoices());
    f();
    speechSynthesis.addEventListener("voiceschanged", f);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", f);
      speechSynthesis.cancel();
    };
  }, []);
  function speak(text: string) {
    setNotice("");
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith("ar"));
    if (!voice) {
      setNotice(
        t(
          "Nessuna voce araba disponibile. Installa una voce araba nelle impostazioni del dispositivo.",
          "No Arabic voice is available. Install one in your device settings.",
        ),
      );
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = slow ? 0.65 : 0.9;
    speechSynthesis.speak(u);
  }
  function choices(q: number) {
    setOptions(
      shuffled([
        q,
        ...shuffled(
          letters
            .map((_, i) => i)
            .filter(
              (i) =>
                i !== q &&
                (quizMode !== "dots" ||
                  JSON.stringify(dotInfo[letters[i][0]]) !==
                    JSON.stringify(dotInfo[letters[q][0]])),
            ),
        ).slice(0, 3),
      ]),
    );
    setPicked(null);
  }
  function start() {
    const qs = shuffled(letters.map((_, i) => i)).slice(0, 5);
    setQuiz(qs);
    setStep(0);
    setScore(0);
    choices(qs[0]);
  }
  function answer(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === quiz[step];
    if (ok) setScore((s) => s + 1);
    put("alphabet:" + letters[quiz[step]][0], {
      ...data["alphabet:" + letters[quiz[step]][0]],
      lastCorrect: ok,
      attempts: (data["alphabet:" + letters[quiz[step]][0]]?.attempts || 0) + 1,
    });
    put("activity:" + localDay(), true);
  }
  const known = letters.filter((l) => data["alphabet:" + l[0]]?.known).length;
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">
            {t(
              "LE BASI, A PORTATA DI MANO",
              "THE FOUNDATIONS, AT YOUR FINGERTIPS",
            )}
          </div>
          <h1>
            {t("28 lettere. Un nuovo mondo.", "28 letters. A new world.")}
          </h1>
          <p>
            {t(
              "Esplora le forme, ascolta gli esempi e mettiti alla prova.",
              "Explore letter forms, listen to examples and test yourself.",
            )}
          </p>
        </div>
        <button className="primary" onClick={start}>
          {t("Mettiti alla prova · 5 domande", "Test yourself · 5 questions")}
        </button>
      </div>
      <label>
        {t("Tipo di esercizio", "Exercise type")}
        <select
          value={quizMode}
          onChange={(e) => {
            setQuizMode(e.target.value);
            setQuiz([]);
          }}
        >
          <option value="names">
            {t("Nomi e lettere", "Names and letters")}
          </option>
          <option value="dots">
            {t("Numero e posizione dei punti", "Dot number and position")}
          </option>
          <option value="joining">
            {t("Riconosci la forma finale", "Recognise the final form")}
          </option>
        </select>
      </label>
      {quiz.length > 0 && (
        <section
          className="panel alphabet-quiz"
          aria-label={t("Quiz alfabeto", "Alphabet quiz")}
        >
          {step < quiz.length ? (
            <>
              <div className="row">
                <span className="eyebrow">
                  {t("RICONOSCI LA LETTERA", "RECOGNISE THE LETTER")} ·{" "}
                  {step + 1}/5
                </span>
                <button className="back" onClick={() => setQuiz([])}>
                  {t("Chiudi quiz", "Close quiz")}
                </button>
              </div>
              <h2>
                {quizMode === "dots"
                  ? t(
                      "Quale lettera ha questi punti?",
                      "Which letter has these dots?",
                    )
                  : quizMode === "joining"
                    ? t(
                        "Quale lettera corrisponde a questa forma finale?",
                        "Which letter matches this final form?",
                      )
                    : t(
                        "Quale lettera si chiama",
                        "Which letter is called",
                      )}{" "}
                {quizMode === "dots"
                  ? `${dotInfo[letters[quiz[step]][0]][0]} ${dotInfo[letters[quiz[step]][0]][1] === "above" ? t("sopra", "above") : dotInfo[letters[quiz[step]][0]][1] === "below" ? t("sotto", "below") : t("punti", "dots")}`
                  : quizMode === "joining"
                    ? "ـ" + letters[quiz[step]][0]
                    : letters[quiz[step]][1]}
                ?
              </h2>
              <div className="alphabet-choices">
                {options.map((i) => (
                  <button
                    key={i}
                    lang="ar"
                    disabled={picked !== null}
                    className={
                      picked !== null && i === quiz[step] ? "right" : ""
                    }
                    onClick={() => answer(i)}
                  >
                    {letters[i][0]}
                  </button>
                ))}
              </div>
              {picked !== null && (
                <div role="status">
                  <p>
                    {picked === quiz[step]
                      ? t("Esatto!", "Correct!")
                      : t(
                          "La lettera corretta è",
                          "The correct letter is",
                        )}{" "}
                    {letters[quiz[step]][0]} · {letters[quiz[step]][1]}
                  </p>
                  <button
                    className="primary"
                    onClick={() => {
                      const n = step + 1;
                      setStep(n);
                      if (n < quiz.length) choices(quiz[n]);
                    }}
                  >
                    {t("Continua →", "Continue →")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>
                {score}/5 · {t("Un passo avanti.", "One step forward.")}
              </h2>
              <p>
                {t(
                  "Le lettere sbagliate sono evidenziate nella griglia. Riguardale e riprova quando vuoi.",
                  "Missed letters are highlighted in the grid. Revisit them and try again whenever you like.",
                )}
              </p>
              <button className="primary" onClick={start}>
                {t("Altre 5 domande", "Another 5 questions")}
              </button>
              <button className="back" onClick={() => setQuiz([])}>
                {t("Torna alle lettere", "Back to letters")}
              </button>
            </>
          )}
        </section>
      )}
      <div className="alphabet-layout">
        <section className="panel alphabet-grid-panel">
          <div className="row">
            <h2>{t("L’alfabeto", "The alphabet")}</h2>
            <span className="muted">
              {known}/28 {t("familiari", "familiar")}
            </span>
          </div>
          <p>
            {t("Si legge da destra a sinistra.", "Read from right to left.")}
          </p>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={filter}
              onChange={(e) => setFilter(e.target.checked)}
            />
            {t(
              "Mostra le lettere che interrompono il collegamento",
              "Show letters that break the connection",
            )}
          </label>
          <div className="alphabet-grid" dir="rtl">
            {letters.map((letter, i) =>
              filter && !nonJoining.includes(letter[0]) ? null : (
                <button
                  key={letter[0]}
                  aria-pressed={index === i}
                  aria-label={letter[1]}
                  onClick={() => {
                    setIndex(i);
                    setNotice("");
                    if (window.matchMedia("(max-width:1100px)").matches)
                      requestAnimationFrame(() =>
                        document
                          .getElementById("letter-detail")
                          ?.scrollIntoView({
                            block: "start",
                            behavior: window.matchMedia(
                              "(prefers-reduced-motion:reduce)",
                            ).matches
                              ? "auto"
                              : "smooth",
                          }),
                      );
                  }}
                  className={
                    (index === i ? "selected " : "") +
                    (data["alphabet:" + letter[0]]?.lastCorrect === false
                      ? "needs-work"
                      : "")
                  }
                >
                  <span lang="ar">{letter[0]}</span>
                  <small dir="ltr">{letter[1]}</small>
                  {data["alphabet:" + letter[0]]?.known && (
                    <i aria-label={t("Familiare", "Familiar")}>✓</i>
                  )}
                </button>
              ),
            )}
          </div>
          <div className="alphabet-legend">
            {t(
              "Bordo ambra: da rivedere dopo il quiz. ✓: lettera che hai segnato come familiare.",
              "Amber border: revisit after the quiz. ✓: a letter you marked as familiar.",
            )}
          </div>
        </section>
        <section id="letter-detail" className="panel letter-detail">
          <div className="letter-heading">
            <span className="letter-large" lang="ar">
              {l[0]}
            </span>
            <div>
              <span className="eyebrow">
                {t("LETTERA", "LETTER")} {index + 1}/28
              </span>
              <h2>{l[1]}</h2>
              <p>
                {t("Suono MSA", "MSA sound")} · /{l[2]}/
              </p>
            </div>
          </div>
          <div className="letter-forms">
            {[
              l[0],
              joined ? l[0] + "ـ" : l[0],
              joined ? "ـ" + l[0] + "ـ" : "ـ" + l[0],
              "ـ" + l[0],
            ].map((f, i) => (
              <div key={i}>
                <span dir="rtl" lang="ar">
                  {f}
                </span>
                <small>
                  {
                    [
                      t("Isolata", "Isolated"),
                      t("Iniziale", "Initial"),
                      t("Mediana", "Medial"),
                      t("Finale", "Final"),
                    ][i]
                  }
                </small>
              </div>
            ))}
          </div>
          <p className="joining-note">
            {joined
              ? t(
                  "Si collega alla lettera precedente e a quella successiva, quando possibile.",
                  "Connects to the preceding and following letters when possible.",
                )
              : t(
                  "Non si collega alla lettera successiva (a sinistra). In posizione iniziale resta isolata; in posizione mediana assume la forma finale.",
                  "Does not connect to the following letter (on the left). Initially it stays isolated; medially it takes the final form.",
                )}
          </p>
          {index === 0 && (
            <p>
              {t(
                "Alif può indicare la vocale lunga ā o fare da supporto alla hamza; non è sempre una consonante.",
                "Alif can represent long ā or carry hamza; it is not always a consonant.",
              )}
            </p>
          )}
          <div className="letter-example">
            <span lang="ar" dir="rtl">
              {l[4]}
            </span>
            <span>{en ? l[6] : l[5]}</span>
          </div>
          <Handwriting key={l[0]} letter={l[0]} />
          <div className="letter-audio">
            <button className="secondary" onClick={() => speak(l[3])}>
              {t("◖ Nome della lettera", "◖ Letter name")}
            </button>
            <button className="secondary" onClick={() => speak(l[4])}>
              {t("◖ Ascolta la parola", "◖ Hear the word")}
            </button>
          </div>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={slow}
              onChange={(e) => setSlow(e.target.checked)}
            />
            {t("Ascolto lento", "Slow playback")}
          </label>
          <small className="muted">
            {t(
              "Voce sintetica del dispositivo; non una registrazione madrelingua. I simboli indicano la pronuncia MSA, con possibili variazioni regionali.",
              "Device speech synthesis, not a native-speaker recording. Symbols indicate MSA pronunciation; regional variations exist.",
            )}
          </small>
          {notice && <p role="status">{notice}</p>}
          <button
            className="primary full spaced"
            onClick={() => {
              put("alphabet:" + l[0], {
                ...data["alphabet:" + l[0]],
                known: !data["alphabet:" + l[0]]?.known,
              });
              put("activity:" + localDay(), true);
            }}
          >
            {data["alphabet:" + l[0]]?.known
              ? t("✓ Familiare · annulla", "✓ Familiar · undo")
              : t("Questa lettera mi è familiare", "This letter is familiar")}
          </button>
          <div className="row spaced">
            <button
              className="back"
              disabled={!index}
              onClick={() => setIndex(index - 1)}
            >
              {t("← Precedente", "← Previous")}
            </button>
            <button
              className="back"
              disabled={index === 27}
              onClick={() => setIndex(index + 1)}
            >
              {t("Successiva →", "Next →")}
            </button>
          </div>
        </section>
      </div>
      <AlphabetAssessment data={data} put={put} />
      <div className="info-banner">
        {t(
          "Questa tavola presenta le 28 lettere di base. Hamza, tāʾ marbūṭa, alif maqṣūra e i segni vocalici si approfondiscono nel percorso A0.",
          "This chart covers the 28 basic letters. Hamza, tāʾ marbūṭa, alif maqṣūra and vowel marks are covered in A0.",
        )}
      </div>
    </>
  );
}
