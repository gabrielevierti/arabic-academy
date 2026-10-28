import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";
export default function OfflineStatus({
  flush,
}: {
  flush: () => Promise<void>;
}) {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a),
    [offline, setOffline] = useState(!navigator.onLine),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    let live = true;
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register(import.meta.env.BASE_URL + "sw.js")
        .then((r) => {
          if (!live) return;
          setWaiting(r.waiting);
          navigator.serviceWorker.ready.then((ready) =>
            ready.active?.postMessage({
              type: "CACHE_VISITED",
              urls: performance.getEntriesByType("resource").map((r) => r.name),
            }),
          );
          r.addEventListener("updatefound", () => {
            r.installing?.addEventListener("statechange", () => {
              if (live && r.waiting && navigator.serviceWorker.controller)
                setWaiting(r.waiting);
            });
          });
        })
        .catch(
          () =>
            live &&
            setMessage(
              t(
                "Modalità offline non disponibile in questo browser.",
                "Offline mode is unavailable in this browser.",
              ),
            ),
        );
    return () => {
      live = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  async function update() {
    try {
      await flush();
      if (!waiting) return;
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => location.reload(),
        { once: true },
      );
      waiting.postMessage("ACTIVATE_UPDATE");
    } catch {
      setMessage(
        t(
          "Salva o esporta i dati prima di aggiornare.",
          "Save or export data before updating.",
        ),
      );
    }
  }
  return (
    <>
      {offline && (
        <div className="notice" role="status">
          {t(
            "Sei offline. Sono disponibili i contenuti già aperti su questo dispositivo.",
            "You are offline. Previously opened content is available on this device.",
          )}
        </div>
      )}
      {waiting && (
        <div className="notice">
          <span>
            {t(
              "Aggiornamento disponibile. Salva e ricarica quando hai finito l’attività.",
              "Update available. Save and reload when you finish the activity.",
            )}
          </span>
          <button className="secondary" onClick={() => void update()}>
            {t("Salva e aggiorna", "Save and update")}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function OfflineSettings() {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a),
    [message, setMessage] = useState("");
  async function clear() {
    if (!("caches" in window)) return;
    const scope = new URL(import.meta.env.BASE_URL, location.href).href;
    await Promise.all(
      (await caches.keys())
        .filter((k) => k.startsWith("arabic-academy:" + scope))
        .map((k) => caches.delete(k)),
    );
    setMessage(
      t(
        "Cache dei contenuti rimossa. I progressi non sono stati modificati.",
        "Content cache removed. Progress has not been changed.",
      ),
    );
  }
  return (
    <section className="panel spaced">
      <h2>{t("Contenuti offline", "Offline content")}</h2>
      <p>
        {t(
          "Solo i contenuti aperti vengono conservati, oltre all’app. I progressi restano separati in IndexedDB. Dopo la rimozione della cache servirà una connessione per riaprire i contenuti.",
          "Only opened content is kept, alongside the app. Progress stays separately in IndexedDB. After clearing the cache you will need a connection to reopen content.",
        )}
      </p>
      <button className="secondary" onClick={() => void clear()}>
        {t("Rimuovi cache dei contenuti", "Clear content cache")}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
