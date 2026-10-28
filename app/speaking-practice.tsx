import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n";
export default function SpeakingPractice() {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a),
    [url, setUrl] = useState(""),
    [recording, setRecording] = useState(false),
    [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    alive = useRef(true),
    pending = useRef(false),
    expanded = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function start() {
    if (pending.current || recorder.current?.state === "recording") return;
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setMessage(
        t(
          "Registrazione non supportata. Serve HTTPS e un browser compatibile.",
          "Recording is unsupported. HTTPS and a compatible browser are required.",
        ),
      );
      return;
    }
    pending.current = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || !expanded.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const r = new MediaRecorder(s),
        chunks: BlobPart[] = [];
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        clearTimeout(timer.current);
        if (alive.current) {
          if (expanded.current)
            setUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })));
          setRecording(false);
        }
      };
      r.start();
      setRecording(true);
      timer.current = setTimeout(
        () => r.state === "recording" && r.stop(),
        120000,
      );
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setMessage(
        t(
          "Microfono non disponibile o permesso negato.",
          "Microphone unavailable or permission denied.",
        ),
      );
    } finally {
      pending.current = false;
    }
  }
  return (
    <details
      className="panel spaced"
      onToggle={(e) => {
        expanded.current = e.currentTarget.open;
        if (!expanded.current) {
          if (recorder.current?.state === "recording") recorder.current.stop();
          setUrl("");
        }
      }}
    >
      <summary>
        {t(
          "Pratica orale · confronto personale",
          "Speaking practice · self-comparison",
        )}
      </summary>
      <p>
        {t(
          "Registra fino a 2 minuti. Il browser chiederà il permesso. L’audio resta in memoria su questo dispositivo e viene eliminato uscendo da questa sezione. Nessun caricamento, riconoscimento o voto automatico.",
          "Record up to 2 minutes. Your browser will ask permission. Audio remains in memory on this device and is discarded when leaving this section. No uploads, recognition or automatic scores.",
        )}
      </p>
      <button
        className="secondary"
        onClick={() => {
          if (recording) {
            if (recorder.current?.state === "recording")
              recorder.current.stop();
          } else void start();
        }}
      >
        {recording
          ? t("Ferma registrazione", "Stop recording")
          : t("Attiva microfono e registra", "Enable microphone and record")}
      </button>
      {url && (
        <>
          <audio controls src={url} />
          <button className="back" onClick={() => setUrl("")}>
            {t("Elimina registrazione", "Delete recording")}
          </button>
        </>
      )}
      <p role="status">
        {recording ? t("Registrazione in corso", "Recording") : message}
      </p>
    </details>
  );
}
