"use client";

/**
 * The app's bottom navigation: Home · Practice · Priya · Community · Me.
 * Priya sits raised in the middle and opens the AI-mentor chat over whatever
 * page you're on (she knows the problem you're looking at). The bar floats
 * above the gesture area, slides away while the keyboard is up, and the
 * active pill glides between tabs.
 */
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CircleUserRound, House, ListChecks, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { openChat } from "@/lib/chat-context";
import { haptic } from "@/lib/native";

type Tab = { href: string; key: string; Icon: typeof House; match: (p: string) => boolean };

const LEFT: Tab[] = [
  { href: "/", key: "native.tabs.home", Icon: House, match: (p) => p === "/" },
  { href: "/practice", key: "native.tabs.practice", Icon: ListChecks, match: (p) => p.startsWith("/practice") || p.startsWith("/challenge") || p.startsWith("/bug-factory") },
];
const RIGHT: Tab[] = [
  { href: "/community", key: "native.tabs.community", Icon: MessagesSquare, match: (p) => p.startsWith("/community") },
  { href: "/me", key: "native.tabs.me", Icon: CircleUserRound, match: (p) => p === "/me" },
];

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      href={tab.href}
      onClick={() => !active && haptic("tap")}
      className="relative flex h-full flex-1 flex-col items-center justify-center gap-[3px] outline-none"
      aria-current={active ? "page" : undefined}
    >
      <span className="relative flex h-7 w-12 items-center justify-center">
        {active && <motion.span layoutId="lf-tab-pill" className="absolute inset-0 rounded-full bg-[#bbf451]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
        <tab.Icon className={cn("relative size-[19px] transition-colors", active ? "text-black" : "text-neutral-400")} strokeWidth={active ? 2.3 : 2} />
      </span>
      <span className={cn("text-[10.5px] font-semibold tracking-[-0.01em] transition-colors", active ? "text-neutral-950" : "text-neutral-400")}>{t(tab.key)}</span>
    </Link>
  );
}

export function TabBar() {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <nav className="lf-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/70 bg-white/85 backdrop-blur-xl" style={{ paddingBottom: "var(--lf-sab)" }} aria-label="Main">
      <div className="mx-auto flex h-[62px] max-w-xl items-stretch px-1.5">
        {LEFT.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={tab.match(path)} />
        ))}
        <button
          type="button"
          onClick={() => {
            haptic("heavy");
            openChat();
          }}
          className="group relative flex flex-1 flex-col items-center justify-end gap-[3px] pb-[7px] outline-none"
          aria-label={t("native.tabs.priya")}
        >
          <span className="absolute -top-5 flex size-[54px] items-center justify-center rounded-full bg-neutral-950 p-[3px] shadow-[0_10px_28px_-6px_rgba(0,0,0,0.45)] ring-4 ring-neutral-50 transition-transform group-active:scale-95">
            <span className="lf-priya-ring absolute inset-0 rounded-full" />
            <img src="/people/priya.jpg" alt="" className="relative size-full rounded-full object-cover" />
            <span className="absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-neutral-950 bg-[#5fd08f]" />
          </span>
          <span className="text-[10.5px] font-semibold tracking-[-0.01em] text-neutral-950">{t("native.tabs.priya")}</span>
        </button>
        {RIGHT.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={tab.match(path)} />
        ))}
      </div>
    </nav>
  );
}
