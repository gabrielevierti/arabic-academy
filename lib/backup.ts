import { validRecord } from "./study-data";
import type { StoredRecords } from "./storage";
export type Backup = {
  format: "arabic-academy";
  version: 2;
  schema: 2;
  createdAt: string;
  data: StoredRecords;
};
const forbidden = new Set(["__proto__", "constructor", "prototype"]);
export function safeValue(value: unknown, depth = 0): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 200000;
  if (Array.isArray(value))
    return value.length <= 50000 && value.every((v) => safeValue(v, depth + 1));
  return (
    typeof value === "object" &&
    Object.entries(value).every(
      ([k, v]) => !forbidden.has(k) && safeValue(v, depth + 1),
    )
  );
}
const known =
  /^(preferences$|micro:|saved:|assessment:|progress:|answer:|note:|card:|quiz:|lesson:|activity:|review:|study:|alphabet:|session:|last$|goal$)/;
export function parseBackup(text: string): {
  data: StoredRecords;
  unknown: string[];
  version: number;
} {
  if (new TextEncoder().encode(text).length > 50_000_000)
    throw Error("Backup exceeds 50 MB.");
  const b = JSON.parse(text);
  if (b?.format !== "arabic-academy" || ![1, 2].includes(b.version))
    throw Error("Unsupported backup format or future version.");
  if (b.version === 2 && b.schema !== 2)
    throw Error("Unsupported storage schema.");
  if (!b.data || typeof b.data !== "object" || Array.isArray(b.data))
    throw Error("Invalid records.");
  const entries = Object.entries(b.data),
    unknown: string[] = [];
  if (entries.length > 50000) throw Error("Too many records.");
  for (const [k, v] of entries) {
    if (
      !k ||
      k.length > 500 ||
      forbidden.has(k) ||
      !safeValue(v) ||
      JSON.stringify(v).length > 200000
    )
      throw Error("Unsafe record: " + k);
    if (known.test(k)) {
      if (!validRecord(k, v)) throw Error("Invalid record: " + k);
    } else unknown.push(k);
  }
  return { data: b.data, unknown, version: b.version };
}
export const makeBackup = (data: StoredRecords): Backup => ({
  format: "arabic-academy",
  version: 2,
  schema: 2,
  createdAt: new Date().toISOString(),
  data,
});
export function backupConflicts(
  current: StoredRecords,
  incoming: StoredRecords,
) {
  return Object.keys(incoming).filter(
    (k) =>
      Object.hasOwn(current, k) &&
      JSON.stringify(current[k]) !== JSON.stringify(incoming[k]),
  );
}
