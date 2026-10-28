export type VocabularyEntry = {
  id: string;
  lemma: string;
  translation: string;
  transliteration: string;
  source: string;
  level: string;
  provenance: string;
  root?: string;
};
/** Lookup key only, never a claim of morphological equivalence. */
export const lookupKey = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[\u064b-\u0652\u0670\u0640\u2066-\u2069]/g, "")
    .trim();
export function lookupWord(entries: VocabularyEntry[], text: string) {
  const key = lookupKey(text);
  return entries.filter((e) => lookupKey(e.lemma) === key);
}
export function arabicTokens(text: string) {
  return text.match(/[\p{Script=Arabic}\p{Mark}]+/gu) || [];
}
export async function loadStudyIndex<T>(
  language: string,
  level: string,
  kind: "vocabulary" | "search",
): Promise<T> {
  const r = await fetch(
    import.meta.env.BASE_URL + `study/${language}/${level}-${kind}.json`,
  );
  if (!r.ok) throw Error("Index unavailable");
  return r.json();
}
