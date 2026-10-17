#!/usr/bin/env node
/**
 * Builds the Android app:   npm run app:build [-- --server http://192.168.1.5:3000] [--open]
 *
 *   1. exports the web app as static files (apps/web/out) with the app shell on
 *      (NEXT_PUBLIC_LAYERFLOW_APP=1) and the default Layerflow server baked in
 *   2. fixes up the export for a file server (the router's segment files) and
 *      drops website-only media nothing in the app references (the landing
 *      page's videos) so the APK stays small
 *   3. copies it into the Android project and updates native plugins (cap sync)
 *   4. --open: opens the project in Android Studio (--no-sync: stop after step 2)
 *
 * The server can also come from LAYERFLOW_APP_SERVER. Default http://10.0.2.2:3000
 * is how the Android emulator reaches `npm start` on this machine; a phone
 * needs this machine's LAN IP or a deployed URL — and the learner can change it
 * any time in the app (Me → Server).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps/web");
const mobileDir = path.join(root, "apps/mobile");
const outDir = path.join(webDir, "out");
const NEXT = path.join(root, "node_modules/next/dist/bin/next");
const CAP = path.join(root, "node_modules/@capacitor/cli/bin/capacitor");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? "") : undefined;
};
const server = flag("--server") ?? process.env.LAYERFLOW_APP_SERVER ?? "http://10.0.2.2:3000";

function step(title) {
  console.log(`\n▸ ${title}`);
}

function exec(cmd, cmdArgs, cwd, env = {}) {
  return spawnSync(process.execPath, [cmd, ...cmdArgs], { cwd, stdio: "inherit", env: { ...process.env, ...env } }).status ?? 1;
}

function run(cmd, cmdArgs, cwd, env = {}) {
  const status = exec(cmd, cmdArgs, cwd, env);
  if (status !== 0) process.exit(status);
}

step(`exporting the web app (server: ${server})`);
rmSync(outDir, { recursive: true, force: true });
// A static export always compiles in apps/web/.next (it only copies the result to out/),
// and .next is where the website's own build lives — the one `npm start` serves. Park it
// while the app builds and put it back after, so building the app never breaks the site.
const webBuild = path.join(webDir, ".next");
const parked = path.join(webDir, ".next-website");
const hadWebBuild = existsSync(webBuild);
if (hadWebBuild) {
  rmSync(parked, { recursive: true, force: true });
  try {
    renameSync(webBuild, parked);
  } catch {
    console.error("✗ apps/web/.next is in use — stop `npm start` / `npm run dev` in this folder, then build the app again.");
    process.exit(1);
  }
}
const built = exec(NEXT, ["build"], webDir, {
  NEXT_PUBLIC_LAYERFLOW_APP: "1",
  NEXT_PUBLIC_LAYERFLOW_SERVER: server,
  NEXT_TELEMETRY_DISABLED: "1",
});
rmSync(webBuild, { recursive: true, force: true });
if (hadWebBuild) renameSync(parked, webBuild);
if (built !== 0) process.exit(built);

step("flattening the router's segment files");
// Next 16 exports per-segment payloads nested (dashboard/__next.dashboard/__PAGE__.txt)
// but its client router requests them flat (dashboard/__next.dashboard.__PAGE__.txt).
// A server would 404 those prefetches; give each nested file its flat twin.
let flattened = 0;
const flatten = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      const walk = (sub, prefix) => {
        for (const n of readdirSync(sub)) {
          const q = path.join(sub, n);
          if (statSync(q).isDirectory()) walk(q, `${prefix}.${n}`);
          else {
            copyFileSync(q, path.join(dir, `${prefix}.${n}`));
            flattened += 1;
          }
        }
      };
      walk(p, name);
    } else flatten(p);
  }
};
flatten(outDir);
console.log(`  ${flattened} segment files`);

step("dropping media only the website uses");
const shipped = [];
const collect = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) collect(p);
    // markup and code only: Tailwind's CSS keeps every class it saw in the sources,
    // but a class (and the image in it) is only used if a shipped component names it
    else if (/\.(html|txt|js)$/.test(name)) shipped.push(readFileSync(p, "utf8"));
  }
};
collect(outDir);
const everything = shipped.join("\n");
let saved = 0;
for (const name of readdirSync(outDir)) {
  const p = path.join(outDir, name);
  if (!statSync(p).isFile() || !/\.(mp4|webm|mov|png|jpe?g|gif|webp)$/i.test(name)) continue;
  if (everything.includes(`/${name}`)) continue;
  saved += statSync(p).size;
  rmSync(p);
  console.log(`  − ${name}`);
}
console.log(`  saved ${(saved / 1024 / 1024).toFixed(1)} MB`);

if (args.includes("--no-sync")) {
  console.log("\n✓ exported to apps/web/out (--no-sync: the Android project was not touched)");
  process.exit(0);
}

if (!existsSync(path.join(mobileDir, "android"))) {
  step("adding the Android platform (first build only)");
  run(CAP, ["add", "android"], mobileDir);
}
step("syncing into the Android project");
run(CAP, ["sync", "android"], mobileDir);

if (args.includes("--open")) {
  step("opening Android Studio");
  run(CAP, ["open", "android"], mobileDir);
}

console.log("\n✓ app built — open apps/mobile/android in Android Studio, or run: npm run app:open");
