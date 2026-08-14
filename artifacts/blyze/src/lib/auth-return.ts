export function getSafeReturnPath(location: string, fallback = "/live") {
  const queryIndex = location.indexOf("?");
  if (queryIndex < 0) return fallback;

  const candidate = new URLSearchParams(location.slice(queryIndex + 1)).get("returnTo");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  return candidate;
}

export function buildAuthPath(path: "/sign-in" | "/sign-up", returnTo: string) {
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/live";
  return `${path}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
