"use client";

/**
 * The app's opening, once per cold start.
 *
 * The first frame is plain HTML — the mark on black, exactly where Android's
 * launch splash draws it — and a head script (layout.tsx) drops the system
 * splash as soon as that frame is painted, so the hand-over is invisible.
 * Once React is running the mark comes alive: ghost layers lift off the floor
 * (the "layer flow"), a scan line reads it, it locks with a burst, rises to
 * make room for the wordmark, the tagline types, and a chip reports the real
 * sandbox. Then the black splits into layers that slide away in alternate
 * directions. Tap to skip; reduced motion gets a plain fade.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { haptic, isNative, setSystemBarsDark } from "@/lib/native";

export const SPLASH_FLAG = "layerflow-splash";
export const SPLASH_DONE_EVENT = "layerflow-splash-done";

const LIME = "#b8f708";
const BG = "#0a0a0a";
const WALL =
  "M5.59 37.92Q3.98 37.08 3.98 35.27L3.98 15.44Q3.98 13.63 5.53 12.69L24.76 0.94Q26.31 0 26.31 1.81L26.31 25.97L28.85 24.56Q30.44 23.67 32.07 24.44L53.65 34.64Q55.28 35.41 53.69 36.27L30.2 49.03Q28.62 49.9 27.01 49.06Z";
const LAYER =
  "M1.59 48.1Q0 49 1.61 49.84L26.88 63.15Q28.49 64 30.09 63.15L55.59 49.7Q57.2 48.85 55.61 47.97L50.01 44.82Q48.42 43.93 46.82 44.79L28.5 54.68L10.19 45.02Q8.58 44.18 7.01 45.07Z";
const EASE = [0.22, 1, 0.36, 1] as const;
const SLICES = 6;
// the system splash draws a 110dp mark in the middle of the screen (res/drawable/splash_icon.xml)
const MARK_H = 110;
const MARK_W = (MARK_H * 57.2) / 64;
// how far the mark rises so mark + wordmark + tagline sit centred together
const RISE = -58;
const MIN_MS = 2600;
const MAX_MS = 3600;

type Health = { state: "checking" } | { state: "waking" } | { state: "ready"; warm: number | null } | { state: "offline" };

function splashAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_FLAG) === "1";
  } catch {
    return false;
  }
}

function markShown(): void {
  try {
    sessionStorage.setItem(SPLASH_FLAG, "1");
  } catch {
    /* private mode */
  }
  document.documentElement.dataset.splash = "done";
  window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
}

/** Normally the head script already did this; this is the fallback. */
async function hideNativeSplash(): Promise<void> {
  if (!isNative()) return;
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {});
}

function Typed({ text, delay }: { text: string; delay: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    let tick: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      tick = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length && tick) clearInterval(tick);
      }, 26);
    }, delay * 1000);
    return () => {
      clearTimeout(start);
      if (tick) clearInterval(tick);
    };
  }, [text, delay]);
  return (
    <span className="font-mono text-[12.5px] tracking-[0.02em] text-white/55">
      <span className="text-[#b8f708]">›</span> {text.slice(0, n)}
      <span className="lf-caret ml-0.5 inline-block h-[1.05em] w-[7px] translate-y-[2px] bg-[#b8f708]" />
    </span>
  );
}

export function AppSplash() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  // "still": the server-rendered first frame (just the mark) until React can animate
  const [phase, setPhase] = useState<"still" | "play" | "exit" | "done">("still");
  const [health, setHealth] = useState<Health>({ state: "checking" });
  const started = useRef(0);

  useEffect(() => {
    if (splashAlreadyShown()) {
      setPhase("done");
      hideNativeSplash();
      return;
    }
    setSystemBarsDark(true);
    hideNativeSplash();
    // start the show on a frame the device can actually paint, not mid-hydration
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        started.current = performance.now();
        setPhase("play");
      });
    });
    let alive = true;
    // still no answer: a free server that was asleep takes a while to wake — say so, don't call it down
    const giveUp = setTimeout(() => alive && setHealth((h) => (h.state === "checking" ? { state: "waking" } : h)), MAX_MS - 900);
    api
      .health()
      .then((h) => alive && setHealth(h.ok ? { state: "ready", warm: h.sandbox?.warm ?? null } : { state: "offline" }))
      .catch(() => alive && setHealth({ state: "offline" }));
    return () => {
      alive = false;
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(giveUp);
    };
  }, []);

  // leave once the show has run AND the sandbox answered (or the cap is hit)
  useEffect(() => {
    if (phase !== "play") return;
    const elapsed = performance.now() - started.current;
    const wait = health.state === "checking" ? MAX_MS - elapsed : Math.max(0, (reduce ? 900 : MIN_MS) - elapsed);
    const id = setTimeout(() => setPhase("exit"), wait);
    return () => clearTimeout(id);
  }, [health, phase, reduce]);

  useEffect(() => {
    if (phase !== "exit") return;
    haptic("tap");
    const id = setTimeout(
      () => {
        markShown();
        setPhase("done");
      },
      reduce ? 260 : 820,
    );
    return () => clearTimeout(id);
  }, [phase, reduce]);

  const burst = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + (i % 2 ? 0.12 : -0.08);
        const r = 96 + (i % 3) * 28;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.82, s: 3 + (i % 3) * 1.5, rot: (i * 47) % 180 };
      }),
    [],
  );

  if (phase === "done") return null;
  const live = phase !== "still";
  const exiting = phase === "exit";
  const fx = live && !reduce;
  const word = ["L", "a", "y", "e", "r", "F", "l", "o", "w"];

  return (
    <div id="lf-splash" className="fixed inset-0 z-[200] select-none overflow-hidden" onClick={() => phase === "play" && setPhase("exit")} aria-hidden>
      {/* the black, cut into layers that slide apart on exit */}
      {Array.from({ length: SLICES }, (_, i) => (
        <motion.div
          key={i}
          className="absolute inset-x-0"
          style={{ top: `${(i * 100) / SLICES}%`, height: `calc(${100 / SLICES}% + 1px)`, backgroundColor: BG }}
          initial={false}
          animate={exiting ? (reduce ? { opacity: 0 } : { x: i % 2 ? "104%" : "-104%" }) : { x: 0, opacity: 1 }}
          transition={{ duration: reduce ? 0.25 : 0.62, delay: reduce ? 0 : 0.12 + Math.abs(i - (SLICES - 1) / 2) * 0.045, ease: [0.76, 0, 0.24, 1] }}
        />
      ))}

      <motion.div className="absolute inset-0" initial={false} animate={exiting ? { opacity: 0, scale: 1.06 } : { opacity: 1, scale: 1 }} transition={{ duration: 0.32, ease: EASE }}>
        {fx && (
          <>
            {/* a lime grid tipped into perspective, and a bloom behind the mark */}
            <motion.div className="lf-splash-grid absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} />
            <motion.div
              className="absolute left-1/2 top-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(184,247,8,0.20) 0%, rgba(184,247,8,0.05) 38%, transparent 68%)" }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0.75], scale: [0.5, 1.08, 1] }}
              transition={{ duration: 1.6, delay: 0.3, ease: EASE }}
            />
            {/* a scan line sweeping down, like the sandbox reading your code */}
            <motion.div
              className="absolute inset-x-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(184,247,8,0.7), transparent)", boxShadow: "0 0 18px 2px rgba(184,247,8,0.35)" }}
              initial={{ top: "-2%", opacity: 0 }}
              animate={{ top: ["-2%", "102%"], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.2, delay: 0.05, ease: "easeInOut" }}
            />
          </>
        )}

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div className="relative" style={{ width: MARK_W, height: MARK_H }} initial={false} animate={{ y: live ? RISE : 0 }} transition={{ type: "spring", stiffness: 170, damping: 20, delay: reduce ? 0 : 0.95 }}>
            {fx && (
              <>
                <motion.span
                  className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{ borderColor: LIME }}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 0.8, 0], scale: [0.4, 1.4, 2.6] }}
                  transition={{ duration: 0.9, delay: 0.78, ease: "easeOut" }}
                />
                {burst.map((p, i) => (
                  <motion.span
                    key={i}
                    className="absolute left-1/2 top-1/2 rounded-[2px]"
                    style={{ width: p.s, height: p.s, backgroundColor: i % 4 === 0 ? "#ffffff" : LIME }}
                    initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                    animate={{ x: [0, p.x], y: [0, p.y], opacity: [0, 1, 0], rotate: p.rot }}
                    transition={{ duration: 0.85, delay: 0.8 + (i % 5) * 0.012, ease: [0.16, 1, 0.3, 1] }}
                  />
                ))}
              </>
            )}

            <motion.svg
              viewBox="0 0 57.2 64"
              className="absolute inset-0 size-full overflow-visible"
              initial={false}
              animate={fx ? { scale: [1, 0.9, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.55, delay: 0.62, times: [0, 0.35, 0.7, 1], ease: "easeOut" }}
            >
              {/* ghost layers lifting off the floor */}
              {fx &&
                [0, 1, 2].map((i) => (
                  <motion.path
                    key={i}
                    d={LAYER}
                    fill="none"
                    stroke={LIME}
                    strokeWidth={0.9}
                    initial={{ y: 0, opacity: 0 }}
                    animate={{ y: [0, -14 - i * 12, -30 - i * 16], opacity: [0, 0.75 - i * 0.18, 0] }}
                    transition={{ duration: 0.95, delay: 0.08 + i * 0.13, ease: EASE }}
                  />
                ))}
              <path d={LAYER} fill={LIME} />
              <path d={WALL} fill={LIME} />
              {/* a bright outline runs round the wall as the scan passes */}
              {fx && (
                <motion.path
                  d={WALL}
                  fill="none"
                  stroke="#f4ffd6"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.7, delay: 0.12, ease: "easeInOut" }}
                />
              )}
            </motion.svg>

            {/* wordmark + tagline, hung below the mark */}
            {live && (
              <div className="absolute left-1/2 top-full flex -translate-x-1/2 flex-col items-center pt-7">
                <div className="flex text-[42px] font-black leading-none tracking-[-0.045em]" style={{ perspective: 600 }}>
                  {word.map((ch, i) => (
                    <motion.span
                      key={i}
                      className="inline-block"
                      style={{ color: i >= 5 ? LIME : "#ffffff", transformOrigin: "50% 100%" }}
                      initial={{ opacity: 0, y: reduce ? 0 : 26, rotateX: reduce ? 0 : -80, filter: reduce ? "blur(0px)" : "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.55, delay: (reduce ? 0.1 : 1.05) + i * 0.045, ease: EASE }}
                    >
                      {ch}
                    </motion.span>
                  ))}
                </div>
                <div className="mt-4 h-5 whitespace-nowrap">
                  <Typed text={t("native.splash.tagline")} delay={reduce ? 0.2 : 1.55} />
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* live sandbox status */}
        {live && (
          <motion.div
            className="absolute inset-x-0 flex justify-center"
            style={{ bottom: "calc(var(--lf-sab, 0px) + 44px)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0.2 : 1.8, ease: EASE }}
          >
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11.5px] font-medium text-white/60 backdrop-blur">
              <span className="relative flex size-2">
                {(health.state === "checking" || health.state === "waking") && <span className={health.state === "waking" ? "absolute inset-0 animate-ping rounded-full bg-[#f59e0b]/60" : "absolute inset-0 animate-ping rounded-full bg-white/40"} />}
                <span className={health.state === "ready" ? "size-2 rounded-full bg-[#5fd08f]" : health.state === "offline" || health.state === "waking" ? "size-2 rounded-full bg-[#f59e0b]" : "size-2 rounded-full bg-white/50"} />
              </span>
              <AnimatePresence mode="wait">
                <motion.span key={health.state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                  {health.state === "checking"
                    ? t("native.splash.connecting")
                    : health.state === "waking"
                      ? t("native.splash.waking")
                      : health.state === "ready"
                      ? `${t("native.splash.ready")}${health.warm ? ` · ${t("native.splash.warm", { n: health.warm })}` : ""}`
                      : t("native.splash.offline")}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
