"use client";

/**
 * Everything the Android app wraps around the pages, as one module so the
 * root layout can import it only in the app build (the website bundle never
 * contains it): the page (remountable by pull-to-refresh), the pull gesture,
 * and the chrome — splash, tab bar, toasts, native wiring.
 */
import React from "react";
import { AppChrome } from "./AppChrome";
import { PullToRefresh, RefreshBoundary } from "./PullToRefresh";

export function AppRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RefreshBoundary>{children}</RefreshBoundary>
      <PullToRefresh />
      <AppChrome />
    </>
  );
}
