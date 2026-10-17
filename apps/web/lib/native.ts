"use client";

/**
 * Thin wrappers over the Capacitor plugins the Android app uses. Each one is a
 * no-op (or a browser fallback) on the website, so shared components can call
 * them unconditionally. Plugins are imported lazily — they only ever load
 * inside the app.
 */
import { useEffect, useRef } from "react";
import { IS_APP } from "@/lib/platform";

// The app's native bridge defines window.Capacitor before any page script runs;
// reading it (instead of importing @capacitor/core) keeps the website bundle free of it.
export const isNative = (): boolean =>
  IS_APP && typeof window !== "undefined" && !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

/* ── haptics ── */

const HAPTICS_KEY = "layerflow-haptics";
export const hapticsOn = (): boolean => readPref(HAPTICS_KEY) !== "off";
export const setHapticsOn = (on: boolean): void => writePref(HAPTICS_KEY, on ? null : "off");

export type HapticKind = "tap" | "heavy" | "success" | "warning" | "error";

export async function haptic(kind: HapticKind = "tap"): Promise<void> {
  if (!isNative() || !hapticsOn()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "tap") await Haptics.impact({ style: ImpactStyle.Light });
    else if (kind === "heavy") await Haptics.impact({ style: ImpactStyle.Medium });
    else await Haptics.notification({ type: kind === "success" ? NotificationType.Success : kind === "warning" ? NotificationType.Warning : NotificationType.Error });
  } catch {
    /* no vibrator */
  }
}

/* ── system bars: light icons over dark surfaces, dark icons over light ones ── */

export async function setSystemBarsDark(dark: boolean): Promise<void> {
  if (!isNative()) return;
  const { SystemBars, SystemBarsStyle } = await import("@capacitor/core");
  await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
}

/* ── share sheet & external links ── */

export async function share(opts: { title: string; text: string; url?: string }): Promise<void> {
  if (isNative()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ ...opts, dialogTitle: opts.title }).catch(() => {});
    return;
  }
  if (typeof navigator !== "undefined" && navigator.share) await navigator.share(opts).catch(() => {});
}

/** Opens a link outside the app: a Chrome Custom Tab in the app, a new tab on the website. */
export async function openExternal(url: string): Promise<void> {
  if (isNative()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, toolbarColor: "#0a0a0a" }).catch(() => {});
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ── the hardware back button: open sheets close before the page goes back ── */

const backStack: (() => void)[] = [];

/** Run the newest registered back handler; false when there is none. */
export function runBackHandler(): boolean {
  const fn = backStack.pop();
  if (!fn) return false;
  fn();
  return true;
}

/** While `active`, the back button calls `onBack` instead of leaving the page. */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!active || !IS_APP) return;
    const fn = () => latest.current();
    backStack.push(fn);
    return () => {
      const i = backStack.lastIndexOf(fn);
      if (i >= 0) backStack.splice(i, 1);
    };
  }, [active]);
}

/* ── daily streak reminder ──
   Instead of one repeating alarm (which would nag on days already done), the
   app keeps the next seven reminders scheduled and rewrites them whenever it
   learns the streak — so the text carries the real number, and today's is
   skipped once today's problem is solved. */

const REMINDER_KEY = "layerflow-reminder-hour";
const REMINDER_IDS = [7001, 7002, 7003, 7004, 7005, 7006, 7007];
export const DEFAULT_REMINDER_HOUR = 19;

export function reminderHour(): number | null {
  const v = readPref(REMINDER_KEY);
  if (v === null) return null;
  const h = Number(v);
  return Number.isInteger(h) && h >= 0 && h < 24 ? h : null;
}

export async function scheduleStreakReminders(streak: { current: number; todayDone: boolean } | null): Promise<void> {
  if (!isNative()) return;
  const hour = reminderHour();
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) }).catch(() => {});
  if (hour === null) return;
  const perm = await LocalNotifications.checkPermissions().catch(() => null);
  if (perm?.display !== "granted") return;
  const now = new Date();
  const days = streak?.current ?? 0;
  const notifications = REMINDER_IDS.map((id, i) => {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0);
    return { id, at };
  })
    .filter(({ at }, i) => at > now && !(i === 0 && streak?.todayDone))
    .map(({ id, at }) => ({
      id,
      channelId: "streak",
      title: days > 0 ? `Keep your ${days}-day streak alive 🔥` : "One small bug is waiting 🐛",
      body: days > 0 ? "Solve one problem today — five minutes is enough." : "Fix one today and start a streak. Priya's here if you get stuck.",
      schedule: { at, allowWhileIdle: true },
      smallIcon: "ic_stat_layerflow",
      iconColor: "#359462",
      extra: { route: "/practice" },
    }));
  if (notifications.length) await LocalNotifications.schedule({ notifications }).catch(() => {});
}

/** Turn reminders on at `hour` (asking for permission) or off (null). */
export async function setStreakReminder(hour: number | null): Promise<"on" | "off" | "denied"> {
  if (!isNative()) return "off";
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  if (hour === null) {
    writePref(REMINDER_KEY, null);
    await scheduleStreakReminders(null);
    return "off";
  }
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return "denied";
  await LocalNotifications.createChannel({ id: "streak", name: "Streak reminders", description: "A daily nudge to keep your streak", importance: 4, vibration: true }).catch(() => {});
  writePref(REMINDER_KEY, String(hour));
  await scheduleStreakReminders(null);
  return "on";
}

/* ── app info ── */

export async function appVersion(): Promise<string | null> {
  if (!isNative()) return null;
  const { App } = await import("@capacitor/app");
  const info = await App.getInfo().catch(() => null);
  return info ? `${info.version} (${info.build})` : null;
}
