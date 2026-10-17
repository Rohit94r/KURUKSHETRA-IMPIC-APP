#!/usr/bin/env node
/**
 * Draws the source artwork for the launcher icon and splash from the brand
 * mark (the same paths as components/Logo.tsx) into apps/mobile/assets/, then
 * `npm run assets -w @layerflow/mobile` turns them into every Android density.
 *
 *   node apps/mobile/scripts/make-assets.mjs && npm run assets -w @layerflow/mobile
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");
mkdirSync(out, { recursive: true });

const LIME = "#b8f708";
const BG = "#0a0a0a";
const WALL =
  "M5.59 37.92Q3.98 37.08 3.98 35.27L3.98 15.44Q3.98 13.63 5.53 12.69L24.76 0.94Q26.31 0 26.31 1.81L26.31 25.97L28.85 24.56Q30.44 23.67 32.07 24.44L53.65 34.64Q55.28 35.41 53.69 36.27L30.2 49.03Q28.62 49.9 27.01 49.06Z";
const LAYER =
  "M1.59 48.1Q0 49 1.61 49.84L26.88 63.15Q28.49 64 30.09 63.15L55.59 49.7Q57.2 48.85 55.61 47.97L50.01 44.82Q48.42 43.93 46.82 44.79L28.5 54.68L10.19 45.02Q8.58 44.18 7.01 45.07Z";

/** The mark, `h` px tall, centred on a `size` square (transparent unless `bg`). */
function svg(size, h, { bg, glow = false } = {}) {
  const s = h / 64;
  const w = 57.2 * s;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${LIME}" stop-opacity="0.16"/><stop offset="0.6" stop-color="${LIME}" stop-opacity="0.03"/><stop offset="1" stop-color="${LIME}" stop-opacity="0"/></radialGradient></defs>
  ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}
  ${glow ? `<circle cx="${size / 2}" cy="${size / 2}" r="${h * 1.15}" fill="url(#g)"/>` : ""}
  <g transform="translate(${x} ${y}) scale(${s})" fill="${LIME}"><path d="${WALL}"/><path d="${LAYER}"/></g>
</svg>`);
}

const jobs = [
  // legacy (pre-adaptive) icon: the mark on black, full bleed
  ["icon-only.png", svg(1024, 560, { bg: BG, glow: true })],
  // adaptive icon: capacitor-assets insets it a further 16.7% and the launcher masks to
  // ~61%, so the mark is drawn large here and still lands well inside the mask
  ["icon-foreground.png", svg(1024, 540)],
  ["icon-background.png", svg(1024, 0, { bg: BG, glow: false })],
  // pre-Android-12 splash; Android 12+ uses the theme's splash icon instead
  ["splash.png", svg(2732, 300, { bg: BG, glow: true })],
  ["splash-dark.png", svg(2732, 300, { bg: BG, glow: true })],
];

for (const [name, data] of jobs) {
  await sharp(data).png().toFile(path.join(out, name));
  console.log(`  ✓ assets/${name}`);
}
