import { useEffect } from "react";
import { useLanguage } from "../lib/i18n";
export function applyPreferences(p: Record<string, any>) {
  document.documentElement.style.setProperty(
    "--arabic-scale",
    String(p.arabicScale || 1),
  );
  const root=document.documentElement;
  root.dataset.theme=p.theme==='dark'||(p.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
  root.style.setProperty('--reading-size', (p.readingSize||16)+'px');
  root.style.setProperty('--reading-leading',String(p.readingLeading||1.8));
  root.dataset.width=p.readingWidth||'comfortable';
  document.documentElement.dataset.motion = p.reducedMotion
    ? "reduce"
    : "system";
}
export default function Preferences({
  data,
  put,
}: {
  data: Record<string, any>;
  put: (k: string, v: any) => void;
}) {
  const p = data.preferences || {},
    en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a);
  function save(k: string, v: unknown) {
    put("preferences", { ...p, [k]: v });
  }
  useEffect(() => applyPreferences(p), [p]);
  return (
    <section className="panel spaced">
      <h2>Aspetto e lettura</h2>
      <label>Tema del sito<select value={p.theme||'system'} onChange={e=>save('theme',e.target.value)}><option value="system">Segui il dispositivo</option><option value="light">Chiaro</option><option value="dark">Scuro</option></select></label>
      <label>Dimensione del testo delle lezioni<select value={p.readingSize||16} onChange={e=>save('readingSize',Number(e.target.value))}>{[16,18,20,22].map(n=><option key={n} value={n}>{n} px</option>)}</select></label>
      <label>Interlinea delle lezioni<select value={p.readingLeading||1.8} onChange={e=>save('readingLeading',Number(e.target.value))}><option value="1.6">Compatta</option><option value="1.8">Normale</option><option value="2.1">Ampia</option></select></label>
      <label>Larghezza di lettura<select value={p.readingWidth||'comfortable'} onChange={e=>save('readingWidth',e.target.value)}><option value="comfortable">Confortevole</option><option value="wide">Ampia</option></select></label>
      <label>
        {t("Dimensione dell’arabo", "Arabic text size")}
        <select
          value={p.arabicScale || 1}
          onChange={(e) => save("arabicScale", Number(e.target.value))}
        >
          {[1, 1.2, 1.4, 1.6].map((v) => (
            <option key={v} value={v}>
              {v * 100}%
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Velocità audio", "Audio speed")}
        <select
          value={p.audioRate || 0.8}
          onChange={(e) => save("audioRate", Number(e.target.value))}
        >
          {[0.6, 0.8, 1].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
      </label>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={!!p.reducedMotion}
          onChange={(e) => save("reducedMotion", e.target.checked)}
        />
        {t("Riduci le animazioni", "Reduce motion")}
      </label>
      <label>
        {t("Ripassi per blocco", "Reviews per block")}
        <select
          value={p.reviewLimit || 10}
          onChange={(e) => save("reviewLimit", Number(e.target.value))}
        >
          {[5, 10, 20, 30].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <p>
        {t(
          "Nessun account, tracciamento o pubblicità. Progressi e appunti restano nel browser. Le richieste dei contenuti raggiungono il servizio di hosting GitHub Pages; eventuali log del servizio sono regolati dalle sue condizioni.",
          "No account, tracking or advertising. Progress and notes stay in your browser. Content requests reach the GitHub Pages hosting service; its own terms govern hosting logs.",
        )}
      </p>
    </section>
  );
}
