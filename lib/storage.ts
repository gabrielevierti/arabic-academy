/** Schema v2 retains the exact v1 database name and every records-store value. */
export type StoredRecords = Record<string, unknown>;
export type Snapshot = { data: StoredRecords; revision: number };
const clientId = Array.from(crypto.getRandomValues(new Uint32Array(4))).join(
  "-",
);
const name = "arabic-academy:" + import.meta.env.BASE_URL;
export class StorageConflict extends Error {
  constructor() {
    super(
      "Another tab changed these records. Export your pending work, then reload.",
    );
    this.name = "StorageConflict";
  }
}
export function storageMessage(error: unknown): string {
  if (error instanceof StorageConflict) return error.message;
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "Device storage is full. Export a backup and free space before retrying.";
  return error instanceof Error
    ? error.message
    : "Local storage unavailable. Your pending changes have not been saved.";
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, 2);
    } catch (e) {
      reject(e);
      return;
    }
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("records"))
        db.createObjectStore("records");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error(
          "Close older Arabo da Zero tabs, then retry the storage upgrade.",
        ),
      );
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) {
        db.close();
        return;
      }
      resolve(db);
    };
  });
}
export async function readSnapshot(): Promise<Snapshot> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["records", "meta"], "readonly"),
      s = tx.objectStore("records");
    const keys = s.getAllKeys(),
      values = s.getAll(),
      revision = tx.objectStore("meta").get("revision");
    tx.oncomplete = () => {
      db.close();
      resolve({
        data: Object.fromEntries(
          keys.result.map((k, i) => [String(k), values.result[i]]),
        ),
        revision: revision.result || 0,
      });
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function readRecords() {
  return (await readSnapshot()).data;
}
/** Compare and swap in one transaction. Never retry a stale mutation blindly. */
export async function commitRecords(
  updates: StoredRecords,
  base: Snapshot,
  replace = false,
): Promise<Snapshot> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["records", "meta"], "readwrite"),
      s = tx.objectStore("records"),
      m = tx.objectStore("meta");
    let conflict = false,
      result: Snapshot,
      writeError: unknown;
    const keys = s.getAllKeys(),
      values = s.getAll(),
      revision = m.get("revision");
    revision.onsuccess = () => {
      const current = Object.fromEntries(
        keys.result.map((k, i) => [String(k), values.result[i]]),
      );
      conflict = replace
        ? (revision.result || 0) !== base.revision
        : Object.keys(updates).some(
            (k) => JSON.stringify(current[k]) !== JSON.stringify(base.data[k]),
          );
      if (conflict) {
        tx.abort();
        return;
      }
      try {
        if (replace) s.clear();
        for (const [key, value] of Object.entries(updates)) s.put(value, key);
      } catch (e) {
        writeError = e;
        tx.abort();
        return;
      }
      const next = (revision.result || 0) + 1;
      m.put(next, "revision");
      result = {
        data: replace ? { ...updates } : { ...current, ...updates },
        revision: next,
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
      try {
        const c = new BroadcastChannel(name);
        c.postMessage({ revision: result.revision, clientId });
        c.close();
      } catch {}
    };
    tx.onabort = () => {
      db.close();
      reject(
        conflict
          ? new StorageConflict()
          : writeError ||
              tx.error ||
              new Error("Write interrupted; previous records retained."),
      );
    };
  });
}
export function subscribeStorage(listener: () => void) {
  let c: BroadcastChannel | undefined;
  try {
    c = new BroadcastChannel(name);
    c.onmessage = (e) => {
      if (e.data?.clientId !== clientId) listener();
    };
  } catch {}
  return () => c?.close();
}
