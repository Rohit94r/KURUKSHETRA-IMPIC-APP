"use client";

/**
 * The app's Home tab — the website's landing page is a pitch; this is a
 * learner's day: what to fix next and why, the streak, where to jump in,
 * the mistakes that keep coming back, mastery, and recent runs.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ArrowRight, Bug, CheckCircle2, ChevronRight, CircleX, CloudOff, Flame, FolderTree, Gift, LayoutDashboard, RefreshCcw, Trophy, Video, Zap } from "lucide-react";
import { AppShell, SandboxStatus, SectionLabel } from "@/components/app/AppShell";
import { LEVEL_STYLE, MasteryBar, TAG_COLOR } from "@/components/app/bits";
import { api, timeAgo, type ChallengeSummary, type LearnerView, type RewardsSummary } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { useLearner } from "@/lib/learner";
import { challengeHref, serverUrl } from "@/lib/platform";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const TILES = [
  { href: "/mentoring", title: "app.mentoring", desc: "native.tiles.mentoring", Icon: Video, tint: "bg-[#e8f1fe] text-[#1a73e8]" },
  { href: "/bug-factory", title: "app.bugFactory", desc: "native.tiles.bugFactory", Icon: Bug, tint: "bg-[#fff2df] text-[#c64e27]" },
  { href: "/repo", title: "app.repo", desc: "native.tiles.repo", Icon: FolderTree, tint: "bg-[#f2eeff] text-[#7B35F0]" },
  { href: "/bounty", title: "app.bounty", desc: "native.tiles.bounty", Icon: Trophy, tint: "bg-[#fff6e3] text-[#b45309]" },
  { href: "/rewards", title: "app.rewards", desc: "native.tiles.rewards", Icon: Gift, tint: "bg-[#ffe8f1] text-[#db2777]" },
  { href: "/dashboard", title: "app.dashboard", desc: "native.tiles.dashboard", Icon: LayoutDashboard, tint: "bg-[#eeffe8] text-[#2f7c53]" },
];

function greetingKey(): string {
  const h = new Date().getHours();
  return h < 12 ? "native.home.morning" : h < 17 ? "native.home.afternoon" : "native.home.evening";
}

/** The last seven local days, oldest first, as YYYY-MM-DD. */
function lastSevenDays(): { day: string; label: string }[] {
  const out: { day: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ day, label: d.toLocaleDateString(undefined, { weekday: "narrow" }) });
  }
  return out;
}

function Rise({ i, children, className }: { i: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.04 + i * 0.05, ease: EASE }} className={className}>
      {children}
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-neutral-200/70" />
      <div className="h-52 animate-pulse rounded-[28px] bg-neutral-200/70" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-200/70" />
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-200/70" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-200/70" />
        ))}
      </div>
    </div>
  );
}

function ServerDown({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 rounded-[28px] border border-neutral-200/80 bg-white p-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#fff2df] text-[#c64e27]">
        <CloudOff className="size-6" />
      </div>
      <p className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{t("native.home.serverDown")}</p>
      <p className="mx-auto mt-2 max-w-xs text-[13.5px] leading-[1.55] text-neutral-500">{t("native.home.serverDownBody")}</p>
      <p className="mx-auto mt-3 w-fit max-w-full truncate rounded-full bg-neutral-100 px-3 py-1 font-mono text-[11.5px] text-neutral-600">{serverUrl() || "same origin"}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={onRetry} className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-[14px] font-semibold text-white active:scale-[0.98]">
          <RefreshCcw className="size-4" /> {t("native.home.retry")}
        </button>
        <Link href="/me#server" className="inline-flex h-11 items-center rounded-full border border-neutral-200 bg-white px-5 text-[14px] font-semibold text-neutral-800">
          {t("native.home.changeServer")}
        </Link>
      </div>
    </div>
  );
}

function UpNext({ me, challenge }: { me: LearnerView; challenge: ChallengeSummary | undefined }) {
  const { t } = useI18n();
  const id = me.next_challenge.challenge_id;
  return (
    <Link href={challengeHref(id)} className="lf-ink-card group relative block overflow-hidden rounded-[28px] bg-neutral-950 p-5 text-white active:scale-[0.99]" style={{ transition: "transform .15s" }}>
      {/* layered mark, echoing the splash */}
      <svg viewBox="0 0 120 120" className="pointer-events-none absolute -right-6 -top-6 size-40 opacity-[0.14]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d="M10 70 L60 95 L110 70 L60 45 Z" transform={`translate(0 ${-i * 14})`} fill="none" stroke="#bbf451" strokeWidth="2" />
        ))}
      </svg>
      <div className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-[#bbf451]/10 blur-2xl" />
      <p className="relative text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#bbf451]">{t("native.home.upNext")}</p>
      <p className="relative mt-2 text-[24px] font-semibold leading-[1.1] tracking-[-0.035em]">{challenge?.title ?? id}</p>
      {challenge && <p className="relative mt-1.5 truncate font-mono text-[12px] text-white/45">{challenge.signature}</p>}
      {challenge && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize", LEVEL_STYLE[challenge.difficulty])}>{challenge.difficulty}</span>
          {challenge.concept_labels.slice(0, 2).map((c) => (
            <span key={c} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/70">
              {c}
            </span>
          ))}
        </div>
      )}
      <p className="relative mt-4 line-clamp-3 text-[13px] leading-[1.55] text-white/65">
        <span className="font-semibold text-white/85">{t("native.home.why")}: </span>
        {me.next_challenge.reason}
      </p>
      <span className="relative mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#bbf451] px-5 text-[14px] font-bold text-black">
        {t("native.home.start")} <ArrowRight className="size-4 transition-transform group-active:translate-x-0.5" />
      </span>
    </Link>
  );
}

function StreakCard({ me, rw }: { me: LearnerView; rw: RewardsSummary | null }) {
  const { t } = useI18n();
  const streak = rw?.streak ?? me.streak.current;
  const todayDone = rw?.today_done ?? me.streak.today_done;
  const atRisk = rw?.at_risk ?? me.streak.at_risk;
  const active = useMemo(() => new Set(me.activity.filter((a) => a.n > 0).map((a) => a.day)), [me.activity]);
  const week = useMemo(lastSevenDays, []);
  return (
    <Link href="/rewards" className="lf-tint-orange block rounded-3xl border border-[#f0d9b8]/70 bg-[#fff2df] p-4 active:scale-[0.98]" style={{ transition: "transform .15s" }}>
      <div className="flex items-center gap-1.5">
        <Flame className={cn("size-5", streak > 0 ? "fill-[#f59e0b]/40 text-[#e8792b]" : "text-[#e8792b]/50", atRisk && "animate-pulse")} />
        <span className="text-[26px] font-semibold leading-none tracking-[-0.04em] text-neutral-950 tabular-nums">
          <NumberFlow value={streak} />
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] font-semibold text-neutral-800">{streak > 0 ? t("native.home.streak", { n: streak }) : t("native.home.noStreak")}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.4] text-neutral-500">{todayDone ? t("native.home.todayDone") : atRisk ? t("native.home.atRisk") : t("native.home.startStreak")}</p>
      <div className="mt-3 flex justify-between">
        {week.map((d, i) => (
          <div key={d.day} className="flex flex-col items-center gap-1">
            <span className={cn("size-[11px] rounded-full", active.has(d.day) ? "bg-[#e8792b]" : i === 6 ? "border-[1.5px] border-dashed border-[#e8792b]/60" : "bg-[#e8792b]/15")} />
            <span className="text-[9px] font-semibold text-neutral-400">{d.label}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

function PointsCard({ me, rw }: { me: LearnerView; rw: RewardsSummary | null }) {
  const { t } = useI18n();
  const points = rw?.points ?? me.streak.points;
  return (
    <Link href="/rewards" className="lf-tint-green flex flex-col rounded-3xl border border-[#cfe9c8]/80 bg-[#eeffe8] p-4 active:scale-[0.98]" style={{ transition: "transform .15s" }}>
      <div className="flex items-center gap-1.5">
        <Zap className="size-5 fill-[#bbf451] text-[#4d7c0f]" />
        <span className="text-[26px] font-semibold leading-none tracking-[-0.04em] text-neutral-950 tabular-nums">
          <NumberFlow value={points} />
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] font-semibold text-neutral-800">{t("native.home.points")}</p>
      {rw?.inr && <p className="mt-0.5 text-[11px] text-neutral-500">≈ {rw.inr}</p>}
      <div className="mt-auto grid grid-cols-3 gap-1 pt-3 text-center">
        {[
          [me.totals.challenges_cleared, "native.home.cleared"],
          [me.totals.first_try_passes, "native.home.firstTry"],
          [me.totals.submissions, "native.home.submissions"],
        ].map(([n, k]) => (
          <div key={k as string} className="rounded-xl bg-white/70 py-1.5">
            <p className="text-[14px] font-semibold leading-none text-neutral-950 tabular-nums">{n as number}</p>
            <p className="mt-0.5 truncate px-0.5 text-[9px] font-medium text-neutral-500">{t(k as string)}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

export function AppHome() {
  const { t } = useI18n();
  const [learner] = useLearner();
  const [me, setMe] = useState<LearnerView | null>(null);
  const [rw, setRw] = useState<RewardsSummary | null>(null);
  const [bank, setBank] = useState<Record<string, ChallengeSummary>>({});
  const [down, setDown] = useState(false);

  const load = useCallback(() => {
    if (!learner) return;
    setDown(false);
    Promise.all([api.learner(learner), api.challenges(true)])
      .then(([m, c]) => {
        setMe(m);
        setBank(Object.fromEntries(c.challenges.map((x) => [x.id, x])));
      })
      .catch(() => setDown(true));
    api.rewardsSummary(learner).then(setRw).catch(() => {});
  }, [learner]);
  useEffect(load, [load]);

  const concepts = useMemo(() => {
    if (!me) return [];
    const keys = me.touched_concepts.length ? me.touched_concepts : Object.keys(me.mastery);
    return keys
      .map((k) => ({ k, v: me.mastery[k] ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 4);
  }, [me]);

  return (
    <AppShell title="Layerflow" subtitle={learner ?? undefined}>
      <Rise i={0} className="mb-5">
        <p className="text-[14px] font-medium text-neutral-500">{t(greetingKey())},</p>
        <p className="text-[30px] font-semibold leading-[1.1] tracking-[-0.045em] text-neutral-950">
          {learner ?? "…"} <span className="inline-block origin-[70%_70%] animate-[lf-wave_1.8s_ease-in-out_0.6s_2]">👋</span>
        </p>
      </Rise>

      {down ? (
        <ServerDown onRetry={load} />
      ) : !me ? (
        <Skeleton />
      ) : (
        <div className="space-y-6">
          <Rise i={1}>
            <UpNext me={me} challenge={bank[me.next_challenge.challenge_id]} />
          </Rise>

          <Rise i={2} className="grid grid-cols-2 gap-3">
            <StreakCard me={me} rw={rw} />
            <PointsCard me={me} rw={rw} />
          </Rise>

          <Rise i={3}>
            <SectionLabel className="mb-2.5 px-1">{t("native.home.jumpIn")}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {TILES.map(({ href, title, desc, Icon, tint }) => (
                <Link key={href} href={href} className="flex flex-col rounded-3xl border border-neutral-200/80 bg-white p-4 active:scale-[0.98]" style={{ transition: "transform .15s" }}>
                  <span className={cn("flex size-10 items-center justify-center rounded-2xl", tint)}>
                    <Icon className="size-[19px]" />
                  </span>
                  <span className="mt-3 text-[14px] font-semibold tracking-[-0.02em] text-neutral-950">{t(title)}</span>
                  <span className="mt-0.5 text-[11.5px] leading-[1.35] text-neutral-500">{t(desc)}</span>
                </Link>
              ))}
            </div>
          </Rise>

          <Rise i={4}>
            <SectionLabel className="mb-2.5 px-1">{t("native.home.patterns")}</SectionLabel>
            <div className="rounded-3xl border border-neutral-200/80 bg-white p-4">
              {me.recurring_mistakes.length === 0 ? (
                <p className="text-[13px] leading-[1.55] text-neutral-500">{t("native.home.patternsEmpty")}</p>
              ) : (
                <div className="space-y-2.5">
                  {me.recurring_mistakes.map((tag) => {
                    const color = TAG_COLOR[tag] ?? "#737373";
                    const where = me.recurring_where[tag] ?? [];
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + "18", color }}>
                          <Bug className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-neutral-900">{me.tag_labels[tag] ?? tag}</p>
                          <p className="truncate text-[11.5px] text-neutral-500">{where.map((w) => bank[w]?.title ?? w).join(" · ")}</p>
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: color + "18", color }}>
                          ×{where.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Rise>

          {concepts.length > 0 && (
            <Rise i={5}>
              <div className="mb-2.5 flex items-baseline justify-between px-1">
                <SectionLabel>{t("native.home.mastery")}</SectionLabel>
                <Link href="/dashboard" className="text-[12px] font-semibold text-[#2f7c53]">
                  {t("native.home.seeAll")}
                </Link>
              </div>
              <div className="space-y-3.5 rounded-3xl border border-neutral-200/80 bg-white p-4">
                {concepts.map(({ k, v }) => (
                  <MasteryBar key={k} label={me.concept_labels[k] ?? k} value={v} />
                ))}
              </div>
            </Rise>
          )}

          {me.history.length > 0 && (
            <Rise i={6}>
              <div className="mb-2.5 flex items-baseline justify-between px-1">
                <SectionLabel>{t("native.home.recent")}</SectionLabel>
                <Link href="/dashboard" className="text-[12px] font-semibold text-[#2f7c53]">
                  {t("native.home.seeAll")}
                </Link>
              </div>
              <div className="divide-y divide-neutral-100 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white">
                {[...me.history]
                  .reverse()
                  .slice(0, 4)
                  .map((h) => (
                    <Link key={h.submission_id} href={challengeHref(h.challenge_id, `submission=${h.submission_id}`)} className="flex items-center gap-3 px-4 py-3 active:bg-neutral-50">
                      {h.passed ? <CheckCircle2 className="size-5 shrink-0 text-[#359462]" /> : <CircleX className="size-5 shrink-0 text-[#c64e27]" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-neutral-900">{bank[h.challenge_id]?.title ?? h.challenge_id}</p>
                        <p className="truncate text-[11.5px] text-neutral-500">
                          {h.passed ? t("native.home.solved") : t("native.home.tried")} · {timeAgo(h.at)}
                          {h.tags.length > 0 && ` · ${h.tags.map((x) => me.tag_labels[x] ?? x).join(", ")}`}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-neutral-300" />
                    </Link>
                  ))}
              </div>
            </Rise>
          )}

          <div className="flex justify-center pt-1">
            <SandboxStatus />
          </div>
        </div>
      )}
    </AppShell>
  );
}
