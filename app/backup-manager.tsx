import { useState } from "react";
import { useLanguage } from "../lib/i18n";
import { backupConflicts, makeBackup, parseBackup } from "../lib/backup";
import type { StoredRecords } from "../lib/storage";
export default function BackupManager({
  data,
  disabled,
  importData,
}: {
  data: StoredRecords;
  disabled: boolean;
  importData: (
    d: StoredRecords,
    replace: boolean,
    expected: StoredRecords,
  ) => Promise<void>;
}) {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a);
  const [preview, setPreview] = useState<ReturnType<typeof parseBackup> | null>(
      null,
    ),
    [baseline, setBaseline] = useState(data),
    [mode, setMode] = useState("merge"),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(makeBackup(data), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "arabic-academy-backup-v2.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function inspect(file?: File) {
    setPreview(null);
    setMessage("");
    setConfirm(false);
    if (!file) return;
    try {
      if (file.size > 50_000_000) throw Error("Maximum 50 MB");
      const p = parseBackup(await file.text());
      setPreview(p);
      setBaseline(data);
    } catch (e) {
      setMessage(
        t(
          "Backup rifiutato. Nessun dato modificato. ",
          "Backup rejected. No data changed. ",
        ) + String(e),
      );
    }
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    try {
      await importData(
        mode === "merge"
          ? Object.fromEntries(
              Object.entries(preview.data).filter(
                ([k]) => !Object.hasOwn(baseline, k),
              ),
            )
          : preview.data,
        mode === "replace",
        baseline,
      );
      setPreview(null);
      setMessage(
        t(
          "Importazione completata e salvata.",
          "Import committed successfully.",
        ),
      );
    } catch (e) {
      setMessage(
        t(
          "Importazione annullata: i dati precedenti restano disponibili. ",
          "Import aborted: previous data remains available. ",
        ) + String(e),
      );
    } finally {
      setBusy(false);
    }
  }
  const conflicts = preview ? backupConflicts(baseline, preview.data) : [];
  return (
    <section className="panel backup-manager">
      <h2>{t("Backup e recupero", "Backup and recovery")}</h2>
      <p>
        {t(
          "I dati restano su questo dispositivo. Esporta una copia prima di cancellare i dati del browser.",
          "Data stays on this device. Export a copy before clearing browser data.",
        )}
      </p>
      <div className="row actions">
        <button className="primary" disabled={disabled} onClick={download}>
          {t("Esporta backup JSON", "Export JSON backup")}
        </button>
        <label className="secondary upload">
          {t("Importa backup", "Import backup")}
          <input
            type="file"
            accept=".json,application/json"
            disabled={disabled || busy}
            onChange={(e) => {
              void inspect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
      {preview && (
        <div className="spaced">
          <h3>{t("Anteprima importazione", "Import preview")}</h3>
          <p>
            {Object.keys(preview.data).length} {t("record", "records")} · v
            {preview.version} · {conflicts.length} {t("conflitti", "conflicts")}{" "}
            · {preview.unknown.length}{" "}
            {t("record sconosciuti conservati", "unfamiliar records preserved")}
          </p>
          <details>
            <summary>
              {t("Identificativi in conflitto", "Conflicting identifiers")}
            </summary>
            <ul>
              {conflicts.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </details>
          <label>
            {t("Modalità", "Mode")}
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setConfirm(false);
              }}
            >
              <option value="merge">
                {t(
                  "Unisci · conserva le voci locali in conflitto",
                  "Merge · keep local conflicts",
                )}
              </option>
              <option value="replace">
                {t("Sostituisci tutti i dati", "Replace all data")}
              </option>
            </select>
          </label>
          <p>
            {t(
              "L’unione aggiunge solo le voci assenti. Per sostituire quelle esistenti scegli sostituzione completa.",
              "Merge adds missing records only. To overwrite existing records, choose full replacement.",
            )}
          </p>
          {mode === "replace" && (
            <label className="inline-check">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              {t(
                "Ho esportato un backup e accetto di eliminare i dati locali assenti dal file.",
                "I exported a backup and agree to remove local data absent from this file.",
              )}
            </label>
          )}
          <button
            className="primary"
            disabled={busy || (mode === "replace" && !confirm)}
            onClick={() => void apply()}
          >
            {busy
              ? t("Salvataggio…", "Saving…")
              : t("Conferma importazione", "Confirm import")}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            {t("Annulla", "Cancel")}
          </button>
        </div>
      )}
    </section>
  );
}
