import { useEffect, useRef, useState } from "react";
import {
  commitRecords,
  readSnapshot,
  subscribeStorage,
  storageMessage,
  type Snapshot,
} from "./storage";
import { nextReview, parseAnswerKey } from "./learning";
type Data = Record<string, any>;
export function useProgressStore() {
  const [data, setData] = useState<Data>({}),
    [loaded, setLoaded] = useState(false),
    [sync, setSync] = useState("Caricamento…"),
    [error, setError] = useState("");
  const dataRef = useRef<Data>({}),
    base = useRef<Snapshot>({ data: {}, revision: 0 }),
    dirty = useRef<Data>({}),
    busy = useRef<Promise<void> | null>(null),
    ready = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    importing = useRef(false);
  function publish(d: Data) {
    dataRef.current = d;
    setData(d);
  }
  async function load() {
    try {
      const s = await readSnapshot();
      base.current = s;
      publish({ ...s.data, ...dirty.current });
      ready.current = true;
      setLoaded(true);
      setSync("Salvato sul dispositivo");
      setError("");
    } catch (e) {
      setError(storageMessage(e));
      setSync("Archivio locale non disponibile · Riprova");
    }
  }
  async function flush(): Promise<void> {
    if (busy.current) {
      await busy.current;
      if (Object.keys(dirty.current).length) return flush();
      return;
    }
    if (!ready.current || !Object.keys(dirty.current).length) return;
    const payload = dirty.current;
    dirty.current = {};
    setSync("Salvataggio…");
    const work = (async () => {
      try {
        const s = await commitRecords(payload, base.current);
        base.current = s;
        publish({ ...s.data, ...dirty.current });
        setSync("Salvato sul dispositivo");
        setError("");
      } catch (e) {
        dirty.current = { ...payload, ...dirty.current };
        setSync("Salvataggio non riuscito · Riprova");
        setError(storageMessage(e));
        throw e;
      }
    })();
    busy.current = work;
    try {
      await work;
    } finally {
      busy.current = null;
    }
  }
  function schedule() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 250);
  }
  function put(key: string, value: any) {
    if (!ready.current || importing.current) return;
    const updates: Data = { [key]: value },
      old = dataRef.current[key],
      reviewKey = "review:" + key;
    if (
      parseAnswerKey(key) &&
      ["again", "partial", "good"].includes(value?.rating) &&
      (old?.rating !== value.rating ||
        old?.attempts !== value.attempts ||
        old?.checkedAt !== value.checkedAt)
    )
      if (
        value.rating !== "good" ||
        dataRef.current[reviewKey] ||
        ["again", "partial"].includes(old?.rating)
      )
        updates[reviewKey] = nextReview(
          dataRef.current[reviewKey],
          value.rating === "good" ? "good" : "again",
        );
    Object.assign(dirty.current, updates);
    publish({ ...dataRef.current, ...updates });
    setSync("Modifiche da salvare…");
    schedule();
  }
  async function importData(incoming: Data, replace: boolean, expected: Data) {
    if (importing.current) throw Error("Import already running.");
    importing.current = true;
    try {
      await flush();
      if (JSON.stringify(dataRef.current) !== JSON.stringify(expected))
        throw Error("Data changed since preview. Open the backup again.");
      const s = await commitRecords(incoming, base.current, replace);
      base.current = s;
      publish(s.data);
      setSync("Salvato sul dispositivo");
    } finally {
      importing.current = false;
    }
  }
  useEffect(() => {
    void load();
    const refresh = () => {
      if (
        !Object.keys(dirty.current).length &&
        !busy.current &&
        !importing.current
      )
        void load();
      else
        setError(
          "Another tab changed data. Pending work is preserved; export before reloading.",
        );
    };
    const unsubscribe = subscribeStorage(refresh),
      hide = () => {
        if (document.visibilityState === "hidden") void flush().catch(() => {});
        else refresh();
      },
      unload = (e: BeforeUnloadEvent) => {
        if (Object.keys(dirty.current).length || busy.current) {
          e.preventDefault();
          e.returnValue = "";
        }
      };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", unload);
    return () => {
      clearTimeout(timer.current);
      unsubscribe();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  return { data, dataRef, loaded, sync, error, put, flush, load, importData };
}
