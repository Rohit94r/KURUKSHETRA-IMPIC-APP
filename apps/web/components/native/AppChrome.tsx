"use client";

/**
 * Everything the Android app adds around the pages, mounted once in the root
 * layout so it survives navigation: the opening splash, the tab bar, the
 * offline pill, toasts — and the native wiring: the hardware back button,
 * deep links (layerflow://challenge/<id>), notification taps, the keyboard,
 * the network, system-bar colours, external links in a Custom Tab, and
 * keeping the streak reminders in step with the real streak.
 */
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, Wifi } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { getLearner } from "@/lib/learner";
import { TAB_ROOTS, bountyHref, challengeHref } from "@/lib/platform";
import { isNative, openExternal, runBackHandler, scheduleStreakReminders, setSystemBarsDark } from "@/lib/native";
import { AppSplash, SPLASH_DONE_EVENT, SPLASH_FLAG } from "./AppSplash";
import { TabBar } from "./TabBar";

export const TOAST_EVENT = "layerflow-toast";

/** Show a short message above the tab bar. */
export function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

function splashDone(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_FLAG) === "1";
  } catch {
    return true;
  }
}

/** layerflow://challenge/last-k-total → the in-app route for it. */
function routeForDeepLink(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = [u.host, ...u.pathname.split("/")].filter(Boolean).map(decodeURIComponent);
    if (parts[0] === "challenge" && parts[1]) return challengeHref(parts[1]);
    if (parts[0] === "bounty" && parts[1]) return bountyHref(parts[1]);
    return `/${parts.join("/")}${u.search}`;
  } catch {
    return null;
  }
}

async function refreshReminders(): Promise<void> {
  const learner = getLearner();
  const s = await api.rewardsSummary(learner).catch(() => null);
  await scheduleStreakReminders(s ? { current: s.streak, todayDone: s.today_done } : null);
}

function useNativeWiring(onOffline: (offline: boolean) => void) {
  const router = useRouter();
  const { t } = useI18n();
  const lastBack = useRef(0);
  // listeners are registered once; they read the latest router/t through refs
  const latest = useRef({ router, t });
  useEffect(() => {
    latest.current = { router, t };
  });

  useEffect(() => {
    if (!isNative()) return;
    const handles: { remove: () => Promise<void> }[] = [];
    let cancelled = false;
    const keep = (h: { remove: () => Promise<void> }) => (cancelled ? h.remove() : handles.push(h));

    (async () => {
      const [{ App }, { Keyboard }, { Network }, { LocalNotifications }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/keyboard"),
        import("@capacitor/network"),
        import("@capacitor/local-notifications"),
      ]);

      keep(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (runBackHandler()) return;
          const path = window.location.pathname;
          if (path !== "/") {
            if (TAB_ROOTS.includes(path) || !canGoBack) latest.current.router.push("/");
            else window.history.back();
            return;
          }
          if (Date.now() - lastBack.current < 2000) {
            App.exitApp();
            return;
          }
          lastBack.current = Date.now();
          showToast(latest.current.t("native.exitAgain"));
        }),
      );

      keep(
        await App.addListener("appUrlOpen", ({ url }) => {
          const route = routeForDeepLink(url);
          if (route) latest.current.router.push(route);
        }),
      );

      keep(
        await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) refreshReminders();
        }),
      );

      keep(
        await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
          const route = (action.notification.extra as { route?: string } | undefined)?.route;
          latest.current.router.push(route ?? "/practice");
        }),
      );

      const html = document.documentElement;
      keep(await Keyboard.addListener("keyboardWillShow", () => (html.dataset.keyboard = "open")));
      keep(await Keyboard.addListener("keyboardWillHide", () => (html.dataset.keyboard = "closed")));

      const status = await Network.getStatus().catch(() => null);
      if (status && !status.connected) onOffline(true);
      keep(await Network.addListener("networkStatusChange", (s) => onOffline(!s.connected)));
    })();

    refreshReminders();
    const onPoints = () => refreshReminders();
    window.addEventListener("layerflow-points-refresh", onPoints);

    // links that leave the app open in a Custom Tab instead of replacing the app
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = a?.getAttribute("href") ?? "";
      if (!/^https?:\/\//i.test(href) || new URL(href).origin === window.location.origin) return;
      e.preventDefault();
      openExternal(href);
    };
    document.addEventListener("click", onClick, true);
    const nativeOpen = window.open;
    window.open = (url?: string | URL, target?: string, features?: string) => {
      const href = String(url ?? "");
      if (/^https?:\/\//i.test(href) && new URL(href).origin !== window.location.origin) {
        openExternal(href);
        return null;
      }
      return nativeOpen.call(window, url, target, features);
    };

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
      window.removeEventListener("layerflow-points-refresh", onPoints);
      document.removeEventListener("click", onClick, true);
      window.open = nativeOpen;
    };
  }, [onOffline]);
}

/** Status-bar and nav-bar icons follow the theme (light icons while the splash is up). */
function useSystemBars() {
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    setReady(splashDone());
    const on = () => setReady(true);
    window.addEventListener(SPLASH_DONE_EVENT, on);
    return () => window.removeEventListener(SPLASH_DONE_EVENT, on);
  }, []);
  useEffect(() => {
    if (ready && resolvedTheme) setSystemBarsDark(resolvedTheme === "dark");
  }, [ready, resolvedTheme]);
}

function Toasts() {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      setMsg({ id: Date.now(), text: (e as CustomEvent<string>).detail });
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener(TOAST_EVENT, on);
    return () => {
      window.removeEventListener(TOAST_EVENT, on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[120] flex justify-center px-6" style={{ bottom: "calc(var(--lf-sab) + 84px)" }}>
      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-full bg-neutral-950 px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)]"
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OfflinePill({ offline }: { offline: boolean | null }) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[110] flex justify-center px-4" style={{ top: "calc(var(--lf-sat) + 64px)" }}>
      <AnimatePresence>
        {offline !== null && (
          <motion.div
            key={offline ? "off" : "on"}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={offline ? "flex items-center gap-2 rounded-full bg-[#2a1608] px-3.5 py-2 text-[12px] font-semibold text-[#ffb27a] shadow-lg" : "flex items-center gap-2 rounded-full bg-[#0f2a1a] px-3.5 py-2 text-[12px] font-semibold text-[#7fe0a5] shadow-lg"}
          >
            {offline ? <CloudOff className="size-3.5" /> : <Wifi className="size-3.5" />}
            {offline ? t("native.offline") : t("native.backOnline")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppChrome() {
  // null = nothing to say; true = offline; false = just came back (shown briefly)
  const [offline, setOffline] = useState<boolean | null>(null);
  const onOffline = useRef((off: boolean) => {
    setOffline((prev) => (off ? true : prev === true ? false : null));
    if (!off) setTimeout(() => setOffline((p) => (p === false ? null : p)), 2200);
  }).current;
  useNativeWiring(onOffline);
  useSystemBars();

  return (
    <>
      <TabBar />
      <OfflinePill offline={offline} />
      <Toasts />
      <AppSplash />
    </>
  );
}
