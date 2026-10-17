/**
 * Website or Android app? The same pages ship in both. The website is served
 * by Next with /api proxied to Fastify (one origin). The app is a static
 * export bundled inside the APK (scripts/build-app.mjs sets
 * NEXT_PUBLIC_LAYERFLOW_APP=1), so its /api calls go to a Layerflow server the
 * learner can change in Me → Server. Everything app-only hangs off IS_APP,
 * which is a build-time constant — the website bundle never carries it.
 */
export const IS_APP = process.env.NEXT_PUBLIC_LAYERFLOW_APP === "1";

/**
 * Running inside the Android app itself (not the app's pages opened in a desktop
 * browser). The app's native bridge defines window.Capacitor before any page
 * script runs; reading it keeps @capacitor/core out of the website bundle.
 */
export function isNativeApp(): boolean {
  return IS_APP && typeof window !== "undefined" && !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

const SERVER_KEY = "layerflow-server";
/** Baked in at build time; the Android emulator reaches the host machine at 10.0.2.2. */
export const DEFAULT_SERVER = (process.env.NEXT_PUBLIC_LAYERFLOW_SERVER ?? "http://10.0.2.2:3000").replace(/\/+$/, "");

export function normalizeServer(url: string): string {
  const s = url.trim().replace(/\/+$/, "").replace(/\/api$/, "");
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `http://${s}`;
}

/** The Layerflow server the app talks to ("" on the website: same origin). */
export function serverUrl(): string {
  if (!IS_APP) return "";
  try {
    return localStorage.getItem(SERVER_KEY) || DEFAULT_SERVER;
  } catch {
    return DEFAULT_SERVER;
  }
}

export function setServerUrl(url: string): void {
  try {
    const s = normalizeServer(url);
    if (s && s !== DEFAULT_SERVER) localStorage.setItem(SERVER_KEY, s);
    else localStorage.removeItem(SERVER_KEY);
  } catch {
    /* private mode */
  }
}

/** "/api/…" → an absolute URL on the app's server; anything else passes through. */
export function apiUrl(path: string): string {
  return IS_APP && path.startsWith("/api/") ? serverUrl() + path : path;
}

/**
 * Links to the two id-carrying pages. A static export can't pre-render every
 * challenge or bounty id, so the app ships one placeholder page (`_`) and
 * passes the id in the query instead: /challenge/_?id=last-k-total.
 */
function idHref(base: string, id: string, query?: string): string {
  if (!IS_APP) return `${base}/${id}${query ? `?${query}` : ""}`;
  return `${base}/_?id=${encodeURIComponent(id)}${query ? `&${query}` : ""}`;
}

/** The app's tab-bar destinations: they show the logo instead of a back arrow, and back from them goes Home. */
export const TAB_ROOTS = ["/", "/practice", "/community", "/me"];

export const challengeHref = (id: string, query?: string) => idHref("/challenge", id, query);
export const bountyHref = (id: string, query?: string) => idHref("/bounty", id, query);

/** The page's id: the route param on the website, ?id= on the app's placeholder page. */
export function resolveRouteId(param: string | undefined, search: URLSearchParams | null): string {
  if (param && param !== "_") return decodeURIComponent(param);
  return search?.get("id") ?? "";
}
