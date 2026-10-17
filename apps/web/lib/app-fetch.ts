/**
 * fetch() for the Layerflow API that also works from the Android app.
 *
 * The app's pages are served from inside the APK (https://localhost), so every
 * API request is cross-origin. Through the WebView it would only succeed if the
 * server sent CORS headers for the app — and a plain-http server would be
 * blocked as mixed content. Inside the app these requests therefore go through
 * Android's own HTTP stack (Capacitor's CapacitorHttp), which has neither
 * restriction: the app works with any Layerflow server exactly as it is. On the
 * website it is plain fetch. Either way the caller gets a standard Response.
 */
import { apiUrl, isNativeApp } from "@/lib/platform";

// a sandbox run (or a red-team program hitting its time limit) can legitimately take ~90 s
const CONNECT_MS = 15_000;
const READ_MS = 120_000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(",") + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** The native response as a standard Response (JSON arrives parsed, other bodies as base64). */
function toResponse(res: { status: number; headers: Record<string, string>; data: unknown }): Response {
  const headers = new Headers();
  for (const [k, v] of Object.entries(res.headers ?? {})) {
    try {
      headers.set(k, String(v));
    } catch {
      /* not a header name (e.g. the status line) */
    }
  }
  const status = res.status >= 200 && res.status <= 599 ? res.status : 502;
  const type = headers.get("content-type") ?? "";
  let body: BodyInit | null = null;
  if (![204, 205, 304].includes(status) && res.data != null) {
    if (typeof res.data !== "string") body = JSON.stringify(res.data);
    else if (type.includes("json") || status >= 400) body = res.data;
    else {
      try {
        body = base64ToBlob(res.data, type);
      } catch {
        body = res.data;
      }
    }
  }
  return new Response(body, { status, headers });
}

export async function appFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!isNativeApp()) return fetch(url, init);
  const { CapacitorHttp } = await import("@capacitor/core");
  const headers: Record<string, string> = {};
  // Android looks the body's type up as "Content-Type", so give headers their usual casing
  new Headers(init.headers).forEach((v, k) => (headers[k.replace(/(^|-)([a-z])/g, (_, d: string, c: string) => d + c.toUpperCase())] = v));
  let data: string | undefined;
  let dataType: "file" | undefined;
  if (init.body instanceof Blob) {
    data = await blobToBase64(init.body);
    dataType = "file";
  } else if (typeof init.body === "string") data = init.body;
  const res = await CapacitorHttp.request({
    url,
    method: (init.method ?? "GET").toUpperCase(),
    headers,
    data,
    dataType,
    responseType: "blob",
    connectTimeout: CONNECT_MS,
    readTimeout: READ_MS,
  }).catch((e: unknown) => {
    // behave like fetch: a network failure is a TypeError
    throw new TypeError(e instanceof Error ? e.message : "Network request failed");
  });
  return toResponse(res);
}

/** fetch() for an /api/… path on the current Layerflow server. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return appFetch(apiUrl(path), init);
}
