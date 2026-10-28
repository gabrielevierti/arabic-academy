import { useState } from "react";
import { useLanguage } from "../lib/i18n";
const bank = [
  {
    id: "join-b",
    form: "ـبـ",
    answer: "bāʾ",
    options: ["nūn", "bāʾ", "tāʾ", "ṯāʾ"],
  },
  {
    id: "join-t",
    form: "ـت",
    answer: "tāʾ",
    options: ["bāʾ", "ṯāʾ", "tāʾ", "nūn"],
  },
  {
    id: "join-th",
    form: "ثـ",
    answer: "ṯāʾ",
    options: ["tāʾ", "bāʾ", "nūn", "ṯāʾ"],
  },
  {
    id: "join-n",
    form: "نـ",
    answer: "nūn",
    options: ["nūn", "bāʾ", "tāʾ", "ṯāʾ"],
  },
  {
    id: "join-a",
    form: "ـا",
    answer: "alif",
    options: ["bāʾ", "alif", "nūn", "tāʾ"],
  },
];
export default function AlphabetAssessment({
  data,
  put,
}: {
  data: Record<string, any>;
  put: (k: string, v: any) => void;
}) {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a),
    [active, setActive] = useState(false),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [result, setResult] = useState<number | null>(null);
  const previous = data["assessment:A0-letter-forms"];
  function submit() {
    const score = bank.filter((q) => choices[q.id] === q.answer).length;
    const record = {
      at: new Date().toISOString(),
      score,
      total: 5,
      passed: score >= 4,
      skill: "letter-form-recognition",
      answers: choices,
    };
    put("assessment:A0-letter-forms", {
      ...record,
      history: [...(previous?.history || []), record].slice(-100),
    });
    setResult(score);
    setActive(false);
  }
  return (
    <section className="panel spaced">
      <h2>
        {t("Verifica A0 · forme delle lettere", "A0 check · letter forms")}
      </h2>
      <p>
        {t(
          "Cinque domande sulle forme collegate, distinte dal quiz sui nomi. Soglia: 4/5. Puoi riprovare dopo aver rivisto la spiegazione. Una ripetizione non è una nuova prova indipendente. Non valuta pronuncia, scrittura o livello CEFR.",
          "Five connected-form questions, separate from the letter-name quiz. Threshold: 4/5. Retake after reviewing the explanation. Repeating this bank is not a new independent test. It does not assess pronunciation, handwriting or CEFR level.",
        )}
      </p>
      {!active ? (
        <>
          <p>
            {result !== null
              ? `${result}/5`
              : previous
                ? `${previous.score}/5`
                : t("Non ancora valutato", "Not yet assessed")}
          </p>
          <button
            className="secondary"
            onClick={() => {
              setChoices({});
              setResult(null);
              setActive(true);
            }}
          >
            {t("Inizia verifica", "Start check")}
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {bank.map((q, i) => (
            <fieldset key={q.id}>
              <legend>
                {i + 1}.{" "}
                <bdi lang="ar" dir="rtl" className="assessment-letter">
                  {q.form}
                </bdi>
              </legend>
              {q.options.map((o) => (
                <label className="inline-check" key={o}>
                  <input
                    type="radio"
                    name={q.id}
                    required
                    value={o}
                    checked={choices[q.id] === o}
                    onChange={() => setChoices((v) => ({ ...v, [q.id]: o }))}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="primary">{t("Consegna", "Submit")}</button>
        </form>
      )}
      {result !== null && (
        <ul>
          {bank
            .filter((q) => choices[q.id] !== q.answer)
            .map((q) => (
              <li key={q.id}>
                <bdi lang="ar" dir="rtl">
                  {q.form}
                </bdi>{" "}
                → {q.answer}
              </li>
            ))}
        </ul>
      )}
      {result !== null && result < 4 && (
        <p>
          {t(
            "Ripassa bāʾ, tāʾ, ṯāʾ, nūn e alif nell’alfabeto e nella prima lezione.",
            "Review bāʾ, tāʾ, ṯāʾ, nūn and alif in the alphabet and first lesson.",
          )}
        </p>
      )}
    </section>
  );
}
