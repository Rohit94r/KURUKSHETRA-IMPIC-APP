"use client";

/**
 * Pull down at the top of any screen to reload it. Pages fetch their data in
 * effects, so "reload" means remounting the page: RefreshBoundary (around the
 * page in the root layout) bumps a key when PullToRefresh fires. Pulls that
 * start inside an editor, an input or anything fixed (sheets, drawers, the
 * Meet room) are left alone.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { haptic } from "@/lib/native";
import { refreshPoints } from "@/lib/api";

const REFRESH_EVENT = "layerflow-pull-refresh";
const TRIGGER = 72;
const MAX = 120;

export function RefreshBoundary({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const on = () => setKey((k) => k + 1);
    window.addEventListener(REFRESH_EVENT, on);
    return () => window.removeEventListener(REFRESH_EVENT, on);
  }, []);
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

function startsInsideSomethingElse(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.matches("textarea, input, select, [contenteditable], [data-no-ptr], .lf-editor")) return true;
    if (getComputedStyle(el).position === "fixed") return true;
    el = el.parentElement;
  }
  return false;
}

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const from = useRef<number | null>(null);
  const dist = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      from.current = window.scrollY <= 0 && e.touches.length === 1 && !startsInsideSomethingElse(e.target) ? e.touches[0].clientY : null;
      dist.current = 0;
      armed.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (from.current === null) return;
      const dy = e.touches[0].clientY - from.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (dist.current) setPull(0);
        dist.current = 0;
        return;
      }
      // rubber-band: the further you pull, the less it moves
      const d = Math.min(MAX, dy * 0.45);
      dist.current = d;
      setPull(d);
      if (d >= TRIGGER && !armed.current) {
        armed.current = true;
        haptic("tap");
      } else if (d < TRIGGER) armed.current = false;
    };
    const onEnd = () => {
      if (from.current === null) return;
      from.current = null;
      const fire = dist.current >= TRIGGER;
      dist.current = 0;
      setPull(0);
      if (!fire) return;
      setSpinning(true);
      haptic("heavy");
      window.dispatchEvent(new Event(REFRESH_EVENT));
      refreshPoints();
      setTimeout(() => setSpinning(false), 750);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const shown = spinning ? TRIGGER : pull;
  if (!shown && !spinning) return null;
  const progress = Math.min(1, shown / TRIGGER);
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[35] flex justify-center" style={{ top: "calc(var(--lf-sat) + 56px)" }}>
      <motion.div
        className="flex size-10 items-center justify-center rounded-full border border-neutral-200/80 bg-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]"
        animate={{ y: shown * 0.55, opacity: Math.max(0.2, progress), scale: 0.7 + progress * 0.3 }}
        transition={spinning ? { type: "spring", stiffness: 400, damping: 30 } : { duration: 0 }}
      >
        <svg viewBox="0 0 24 24" className={spinning ? "size-5 animate-spin" : "size-5"} style={spinning ? undefined : { transform: `rotate(${progress * 270}deg)` }}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="#e5e5e5" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="#359462" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${(spinning ? 0.3 : progress * 0.85) * 56.5} 56.5`} transform="rotate(-90 12 12)" />
        </svg>
      </motion.div>
    </div>
  );
}
