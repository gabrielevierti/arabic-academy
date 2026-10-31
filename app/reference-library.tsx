import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { LEVELS } from "../lib/levels";
import {
  loadStudyIndex,
  lookupKey,
  type VocabularyEntry,
} from "../lib/vocabulary";
type Entry = { id: string; title: string; level: string; text: string };
export default function ReferenceLibrary({
  data,
  put,
  onLesson,
}: {
  data: Record<string, any>;
  put: (k: string, v: any) => void;
  onLesson: (id: string) => void;
}) {
  const language = useLanguage(),
    en = language === "en",
    t = (a: string, b: string) => (en ? b : a);
  const [level, setLevel] = useState("A0"),
    [kind, setKind] = useState<"search" | "vocabulary">("search"),
    [query, setQuery] = useState(""),
    [savedOnly, setSavedOnly] = useState(false),
    [rows, setRows] = useState<(Entry | VocabularyEntry)[]>([]),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    setRows([]);
    setError(false);
    loadStudyIndex<(Entry | VocabularyEntry)[]>(language, level, kind)
      .then((r) => live && setRows(r))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [language, level, kind]);
  const matches = (kind === "search" && !query && !savedOnly ? [] : rows)
    .filter(
      (r) =>
        (!savedOnly || !!data["saved:" + r.id]) &&
        lookupKey(JSON.stringify(r))
          .toLowerCase()
          .includes(lookupKey(query).toLowerCase()),
    )
    .slice(0, 60);
  return (
    <section className="panel spaced">
      <h2>
        {t(
          "Cerca nei contenuti e nel lessico",
          "Search content and vocabulary",
        )}
      </h2>
      <div className="row">
        <label>
          {t("Livello", "Level")}
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Indice", "Index")}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="search">
              {t("Testo delle lezioni", "Lesson text")}
            </option>
            <option value="vocabulary">
              {t(
                "Lessico dalle tabelle del corso",
                "Vocabulary from course tables",
              )}
            </option>
          </select>
        </label>
      </div>
      <label>
        {t(
          "Parola, arabo o traslitterazione",
          "Word, Arabic or transliteration",
        )}
        <input
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={savedOnly}
          onChange={(e) => setSavedOnly(e.target.checked)}
        />
        {t("Solo riferimenti salvati", "Saved references only")}
      </label>
      <p className="muted">
        {t(
          "Estratto dal corso, senza analisi morfologica automatica. La provenienza non equivale a revisione linguistica indipendente. Primi 60 risultati.",
          "Extracted from the course, with no automatic morphological analysis. Provenance is not independent linguistic review. First 60 results.",
        )}
      </p>
      {error && (
        <p role="alert">
          {t(
            "Indice non disponibile offline: aprilo quando sei online.",
            "Index unavailable offline: open it while online.",
          )}
        </p>
      )}
      {!error && !matches.length && (
        <p>
          {t(
            "Nessun risultato. Prova un’altra parola o un altro livello.",
            "No results. Try another word or level.",
          )}
        </p>
      )}
      <div className="lesson-list">
        {matches.map((r) =>
          "lemma" in r ? (
            <article key={r.id} className="panel">
              <h3 lang="ar" dir="rtl">
                {r.lemma}
              </h3>
              <p>
                {r.transliteration} · {r.translation}
              </p>
              <div className="row">
                <button className="back" onClick={() => onLesson(r.source)}>
                  {r.source} →
                </button>
                <button
                  className="secondary"
                  disabled={!!data["card:vocab:" + r.id]}
                  onClick={() =>
                    put("card:vocab:" + r.id, {
                      front: r.lemma,
                      back: r.translation,
                      level: r.level,
                      source: r.source,
                      interval: 0,
                    })
                  }
                >
                  {data["card:vocab:" + r.id]
                    ? t("Nel ripasso", "In review")
                    : t("Aggiungi al ripasso", "Add to review")}
                </button>
              </div>
            </article>
          ) : (
            <article key={r.id} className="panel">
              <h3>{r.title}</h3>
              <p>
                {query
                  ? r.text.slice(
                      Math.max(
                        0,
                        r.text.toLowerCase().indexOf(query.toLowerCase()) - 50,
                      ),
                      Math.max(
                        0,
                        r.text.toLowerCase().indexOf(query.toLowerCase()) - 50,
                      ) + 220,
                    ) + "…"
                  : r.text.slice(0, 160) + "…"}
              </p>
              <div className="row">
                <button className="back" onClick={() => onLesson(r.id)}>
                  {t("Leggi il riferimento", "Read reference")} →
                </button>
                <button
                  className="secondary"
                  aria-pressed={!!data["saved:" + r.id]}
                  onClick={() => put("saved:" + r.id, !data["saved:" + r.id])}
                >
                  {data["saved:" + r.id]
                    ? t("Salvato", "Saved")
                    : t("Salva", "Save")}
                </button>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
