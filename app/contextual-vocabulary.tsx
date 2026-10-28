import { useEffect, useState } from "react";
import {
  loadStudyIndex,
  lookupWord,
  type VocabularyEntry,
} from "../lib/vocabulary";
import { useLanguage } from "../lib/i18n";
export default function ContextualVocabulary({
  level,
  put,
  data,
}: {
  data: Record<string, any>;
  level: string;
  put: (k: string, v: any) => void;
}) {
  const language = useLanguage(),
    en = language === "en",
    t = (a: string, b: string) => (en ? b : a),
    [entries, setEntries] = useState<VocabularyEntry[]>([]),
    [word, setWord] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    loadStudyIndex<VocabularyEntry[]>(language, level, "vocabulary")
      .then((r) => live && setEntries(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [level, language]);
  const matches = lookupWord(entries, word);
  return (
    <details className="panel spaced">
      <summary>
        {t(
          "Lessico contestuale · seleziona una parola araba nel testo",
          "Contextual vocabulary · select an Arabic word in the text",
        )}
      </summary>
      <button
        className="secondary"
        onPointerDown={(e) => {
          e.preventDefault();
          setWord(window.getSelection()?.toString().trim() || "");
          setMessage("");
        }}
        onClick={(e) => {
          if (e.detail === 0)
            setWord(window.getSelection()?.toString().trim() || "");
        }}
      >
        {t("Cerca la selezione", "Look up selection")}
      </button>
      <label>
        {t("Oppure scrivi la parola", "Or type the word")}
        <input
          lang="ar"
          dir="rtl"
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
      </label>
      {word && !matches.length && (
        <p>
          {t(
            "Nessuna voce esatta nel lessico di questo livello. Non viene dedotta una radice.",
            "No exact entry in this level’s vocabulary. No root is inferred.",
          )}
        </p>
      )}
      {matches.map((e) => (
        <div key={e.id}>
          <b lang="ar" dir="rtl">
            {e.lemma}
          </b>
          <p>
            {e.translation} · {e.transliteration} · {e.source}
          </p>
          <button
            className="secondary"
            onClick={() => {
              if (!data["card:vocab:" + e.id])
                put("card:vocab:" + e.id, {
                  front: e.lemma,
                  back: e.translation,
                  level: e.level,
                  interval: 0,
                });
              setMessage(t("Aggiunta al ripasso", "Added to review"));
            }}
          >
            {t("Aggiungi al ripasso", "Add to review")}
          </button>
        </div>
      ))}
      <p role="status">{message}</p>
    </details>
  );
}
