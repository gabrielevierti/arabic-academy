/** Course levels published in Arabic Academy, in study order. */
export const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_NAMES: Record<Level, string> = {
  A0: "Alfabetizzazione",
  A1: "Le fondamenta",
  A2: "Autonomia elementare",
  B1: "Competenza intermedia",
  B2: "Competenza operativa",
  C1: "Competenza professionale",
};
/** Main track of each level: every other code is a complementary track. */
export const MAIN_TRACKS = ["L0", "A1", "A2", "B1", "B2", "C1"];
/** Records created when a C2 placeholder existed are shown with C1. */
export const LEGACY_LEVELS: Record<string, Level> = { C2: "C1" };
export function levelOf(item: { level?: string }): string {
  const level = item?.level || "";
  return LEGACY_LEVELS[level] || level;
}
export const isLevel = (value: unknown): value is Level =>
  typeof value === "string" && (LEVELS as readonly string[]).includes(value);
