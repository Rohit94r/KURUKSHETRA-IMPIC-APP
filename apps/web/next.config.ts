import type { NextConfig } from "next";

/**
 * The web app and the API share ONE origin: every /api/* request is proxied to
 * the Fastify API (LAYERFLOW_API_URL, default http://127.0.0.1:4000). Judges get a
 * single URL, the browser never needs CORS, and `curl <url>/api/submit` works.
 *
 * NEXT_PUBLIC_LAYERFLOW_APP=1 (set by scripts/build-app.mjs) builds the Android
 * app instead: a static export into out/ (with output: "export", distDir IS the
 * export folder) that Capacitor bundles into the APK.
 * There is no server in the APK, so no proxy — lib/platform points /api calls
 * at the learner's Layerflow server.
 */
const API = process.env.LAYERFLOW_API_URL ?? "http://127.0.0.1:4000";
const APP = process.env.NEXT_PUBLIC_LAYERFLOW_APP === "1";

const nextConfig: NextConfig = {
  // LAYERFLOW_NEXT_DIST lets a second build (e.g. a verification build) live beside the served one
  distDir: process.env.LAYERFLOW_NEXT_DIST ?? (APP ? "out" : ".next"),
  poweredByHeader: false,
  devIndicators: false,
  // always a literal, so the website build drops every app-only branch
  env: { NEXT_PUBLIC_LAYERFLOW_APP: APP ? "1" : "0" },
  ...(APP
    ? { output: "export" as const, images: { unoptimized: true } }
    : {
        experimental: {
          // a red-team submission can legitimately take several seconds
          proxyTimeout: 90_000,
        },
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
        },
      }),
};

export default nextConfig;
