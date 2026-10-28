export type Route = { view: string; id?: string; level?: string };
const paths: Record<string, string> = {
  home: "",
  micro: "micro",
  course: "course",
  alphabet: "alphabet",
  practice: "practice",
  review: "review",
  flashcards: "flashcards",
  stats: "progress",
  library: "library",
  settings: "settings",
  session: "study",
  "error-session": "review-session",
  lesson: "lesson",
  resource: "reference",
};
export function routeHash(route: Route) {
  return (
    "#/" +
    (paths[route.view] ?? "") +
    (route.id
      ? "/" + encodeURIComponent(route.id)
      : route.view === "course" && route.level
        ? "/" + encodeURIComponent(route.level)
        : "")
  );
}
export function parseRoute(hash: string): Route {
  const [path = "", raw] = hash.replace(/^#\/?/, "").split("/");
  let id;
  try {
    id = raw ? decodeURIComponent(raw) : undefined;
  } catch {
    return { view: "missing" };
  }
  const view = Object.keys(paths).find((v) => paths[v] === path);
  if (!view) return { view: "missing" };
  return { view, ...(view === "course" ? { level: id } : { id }) };
}
