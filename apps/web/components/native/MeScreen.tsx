"use client";

/**
 * The Me tab: who you are (a pseudonym), every screen the tab bar has no room
 * for, and the app's settings — theme, language, haptics, the daily streak
 * reminder, and which Layerflow server the app talks to.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { BellRing, BookOpenText, Bug, ChevronRight, Crown, Flame, FolderTree, Gavel, Gift, LayoutDashboard, Monitor, Moon, ScrollText, Server, ShieldCheck, Smartphone, Sun, Trophy, Vibrate, Video, Zap } from "lucide-react";
import { AppShell, HOW_IT_RUNS, LearnerPicker, SandboxStatus, SectionLabel } from "@/components/app/AppShell";
import { api, type RewardsSummary } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { UI_LANGUAGE_OPTIONS } from "@/lib/i18n/translations";
import { useLearner } from "@/lib/learner";
import { DEFAULT_REMINDER_HOUR, appVersion, haptic, hapticsOn, isNative, reminderHour, setHapticsOn, setStreakReminder } from "@/lib/native";
import { DEFAULT_SERVER, normalizeServer, serverUrl, setServerUrl } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { appFetch } from "@/lib/app-fetch";
import { showToast } from "./AppChrome";

const EXPLORE = [
  { href: "/dashboard", key: "app.dashboard", Icon: LayoutDashboard, tint: "bg-[#eeffe8] text-[#2f7c53]" },
  { href: "/mentoring", key: "app.mentoring", Icon: Video, tint: "bg-[#e8f1fe] text-[#1a73e8]" },
  { href: "/bounty", key: "app.bounty", Icon: Trophy, tint: "bg-[#fff6e3] text-[#b45309]" },
  { href: "/bug-factory", key: "app.bugFactory", Icon: Bug, tint: "bg-[#fff2df] text-[#c64e27]" },
  { href: "/repo", key: "app.repo", Icon: FolderTree, tint: "bg-[#f2eeff] text-[#7B35F0]" },
  { href: "/rewards", key: "app.rewards", Icon: Gift, tint: "bg-[#ffe8f1] text-[#db2777]" },
  { href: "/taxonomy", key: "app.taxonomy", Icon: BookOpenText, tint: "bg-sky-50 text-sky-700" },
  { href: "/ledger", key: "app.ledger", Icon: ScrollText, tint: "bg-neutral-100 text-neutral-700" },
  { href: "/judges", key: "app.judges", Icon: Gavel, tint: "bg-neutral-100 text-neutral-700" },
  { href: "/pricing", key: "app.pricing", Icon: Crown, tint: "bg-neutral-950 text-[#bbf451]" },
  { href: "/admin", key: "app.admin", Icon: ShieldCheck, tint: "bg-neutral-100 text-neutral-700" },
];

const REMINDER_HOURS = [8, 13, 19, 21];

function hourLabel(h: number): string {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Group({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <SectionLabel className="mb-2.5 px-1">{label}</SectionLabel>
      <div className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white">{children}</div>
    </section>
  );
}

function Row({ Icon, tint, title, desc, children, className }: { Icon: typeof Sun; tint: string; title: string; desc?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0", className)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tint)}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-900">{title}</p>
        {desc && <p className="text-[11.5px] leading-[1.4] text-neutral-500">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors", on ? "bg-[#359462]" : "bg-neutral-300")}
    >
      <span className={cn("absolute top-[3px] size-6 rounded-full bg-white shadow transition-[left] duration-200", on ? "left-[23px]" : "left-[3px]")} />
    </button>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-neutral-100 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => {
            haptic("tap");
            onChange(o.value);
          }}
          className={cn("flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold transition-colors", value === o.value ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ServerSettings() {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setDraft(serverUrl());
  }, []);

  const test = async (url: string) => {
    setState("testing");
    try {
      const r = await Promise.race([
        appFetch(`${normalizeServer(url)}/api/health`, { cache: "no-store" }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
      ]);
      const ok = r.ok && ((await r.json()) as { ok?: boolean }).ok === true;
      setState(ok ? "ok" : "fail");
      haptic(ok ? "success" : "error");
      return ok;
    } catch {
      setState("fail");
      haptic("error");
      return false;
    }
  };

  const save = (url: string) => {
    setServerUrl(url);
    showToast(t("native.me.saved"));
    // every page re-reads the server on its next request; a fresh start makes that "now"
    setTimeout(() => window.location.replace("/"), 600);
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-[#bbf451]">
          <Server className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-900">{t("native.me.server")}</p>
          <p className="text-[11.5px] leading-[1.4] text-neutral-500">{t("native.me.serverDesc")}</p>
        </div>
      </div>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setState("idle");
        }}
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={DEFAULT_SERVER}
        className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3.5 font-mono text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
      />
      <div className="flex items-center gap-2">
        <button onClick={() => test(draft)} disabled={state === "testing" || !draft.trim()} className="h-10 rounded-full border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-neutral-800 disabled:opacity-50">
          {state === "testing" ? t("native.me.testing") : t("native.me.test")}
        </button>
        <button
          onClick={async () => {
            if (await test(draft)) save(draft);
          }}
          disabled={state === "testing" || !draft.trim() || normalizeServer(draft) === serverUrl()}
          className="h-10 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {t("native.me.save")}
        </button>
        <button
          onClick={() => {
            setDraft(DEFAULT_SERVER);
            if (serverUrl() !== DEFAULT_SERVER) save(DEFAULT_SERVER);
          }}
          className="ml-auto h-10 px-2 text-[12.5px] font-semibold text-neutral-500"
        >
          {t("native.me.reset")}
        </button>
      </div>
      {(state === "ok" || state === "fail") && (
        <p className={cn("flex items-center gap-2 text-[12px] font-semibold", state === "ok" ? "text-[#2f7c53]" : "text-[#c64e27]")}>
          <span className={cn("size-1.5 rounded-full", state === "ok" ? "bg-[#359462]" : "bg-[#c64e27]")} />
          {state === "ok" ? t("native.me.connected") : t("native.me.unreachable")}
        </p>
      )}
    </div>
  );
}

export function MeScreen() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [learner] = useLearner();
  const [rw, setRw] = useState<RewardsSummary | null>(null);
  const [mounted, setMounted] = useState(false);
  const [native, setNative] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [reminder, setReminder] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device prefs are only readable after mount
    setMounted(true);
    setNative(isNative());
    setHaptics(hapticsOn());
    setReminder(reminderHour());
    appVersion().then(setVersion);
    if (window.location.hash === "#server") setTimeout(() => document.getElementById("server")?.scrollIntoView({ behavior: "smooth" }), 300);
  }, []);
  useEffect(() => {
    if (learner) api.rewardsSummary(learner).then(setRw).catch(() => {});
  }, [learner]);

  const toggleReminder = async (hour: number | null) => {
    const r = await setStreakReminder(hour);
    setDenied(r === "denied");
    setReminder(r === "on" ? hour : null);
    if (r === "on") haptic("success");
  };

  return (
    <AppShell title={t("native.me.title")} subtitle={t("native.me.subtitle")}>
      <div className="space-y-6">
        {/* profile */}
        <div className="lf-ink-card relative overflow-hidden rounded-[28px] bg-neutral-950 p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#bbf451]/15 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-[22px] bg-[#bbf451] text-[28px] font-black uppercase text-black">{learner?.slice(0, 1) ?? "·"}</span>
            <div className="min-w-0">
              <p className="truncate text-[22px] font-semibold tracking-[-0.03em]">{learner ?? "…"}</p>
              <p className="text-[12px] text-white/55">{t("app.pseudonymous")}</p>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold">
              <Flame className="size-3.5 text-[#f59e0b]" /> {t("native.home.streak", { n: rw?.streak ?? 0 })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tabular-nums">
              <Zap className="size-3.5 fill-[#bbf451] text-[#bbf451]" /> {(rw?.points ?? 0).toLocaleString("en-IN")} {t("native.home.points")}
            </span>
            <Link href="/pricing" className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold capitalize", rw?.plan === "pro" ? "bg-[#bbf451] text-black" : "bg-white/10")}>
              <Crown className="size-3.5" /> {t("native.me.plan", { plan: rw?.plan ?? "free" })}
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200/80 bg-white p-4">
          <LearnerPicker />
        </div>

        <Group label={t("native.me.explore")}>
          {EXPLORE.map(({ href, key, Icon, tint }) => (
            <Link key={href} href={href} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 active:bg-neutral-50">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tint)}>
                <Icon className="size-[18px]" />
              </span>
              <span className="flex-1 text-[14px] font-semibold tracking-[-0.01em] text-neutral-900">{t(key)}</span>
              <ChevronRight className="size-4 text-neutral-300" />
            </Link>
          ))}
        </Group>

        <Group label={t("native.me.settings")}>
          <div className="space-y-2.5 border-b border-neutral-100 p-4">
            <p className="text-[13px] font-semibold text-neutral-900">{t("native.me.appearance")}</p>
            <Segmented
              value={mounted ? (theme ?? "system") : "system"}
              onChange={setTheme}
              options={[
                { value: "light", label: <><Sun className="size-3.5" /> {t("native.me.light")}</> },
                { value: "dark", label: <><Moon className="size-3.5" /> {t("native.me.dark")}</> },
                { value: "system", label: <><Monitor className="size-3.5" /> {t("native.me.system")}</> },
              ]}
            />
          </div>
          <div className="space-y-2.5 border-b border-neutral-100 p-4">
            <p className="text-[13px] font-semibold text-neutral-900">{t("native.me.language")}</p>
            <Segmented value={lang} onChange={setLang} options={UI_LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: o.nativeLabel }))} />
          </div>
          {native && (
            <>
              <Row Icon={Vibrate} tint="bg-[#f2eeff] text-[#7B35F0]" title={t("native.me.haptics")} desc={t("native.me.hapticsDesc")}>
                <Switch
                  on={haptics}
                  label={t("native.me.haptics")}
                  onChange={(v) => {
                    setHapticsOn(v);
                    setHaptics(v);
                    if (v) haptic("tap");
                  }}
                />
              </Row>
              <Row Icon={BellRing} tint="bg-[#fff2df] text-[#c64e27]" title={t("native.me.reminder")} desc={t("native.me.reminderDesc", { time: hourLabel(reminder ?? DEFAULT_REMINDER_HOUR) })} className={reminder !== null ? "border-b-0" : undefined}>
                <Switch on={reminder !== null} label={t("native.me.reminder")} onChange={(v) => toggleReminder(v ? DEFAULT_REMINDER_HOUR : null)} />
              </Row>
              {reminder !== null && (
                <div className="border-b border-neutral-100 px-4 pb-4">
                  <Segmented value={reminder} onChange={(h) => toggleReminder(h)} options={REMINDER_HOURS.map((h) => ({ value: h, label: hourLabel(h) }))} />
                </div>
              )}
              {denied && <p className="border-b border-neutral-100 px-4 py-3 text-[12px] font-medium text-[#c64e27]">{t("native.me.reminderDenied")}</p>}
            </>
          )}
        </Group>

        {native && (
          <Group label={t("native.me.server")} id="server">
            <ServerSettings />
          </Group>
        )}

        <Group label={t("native.me.about")}>
          <Row Icon={Smartphone} tint="bg-neutral-950 text-[#bbf451]" title="Layerflow" desc="DI-01 · Debug Dojo · Kurukshetra 2026">
            {version && <span className="font-mono text-[11.5px] text-neutral-400">{version}</span>}
          </Row>
          <div className="p-4">
            <p className="mb-2 text-[13px] font-semibold text-neutral-900">{t("native.me.howRuns")}</p>
            <dl className="overflow-hidden rounded-2xl border border-neutral-200/70 text-[12px]">
              {HOW_IT_RUNS.map(([k, v], i) => (
                <div key={k} className={cn("flex items-center justify-between gap-3 px-3.5 py-2", i % 2 ? "bg-neutral-50/70" : "bg-white")}>
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="text-right font-semibold tracking-[-0.01em] text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <SandboxStatus />
            </div>
          </div>
        </Group>
      </div>
    </AppShell>
  );
}
