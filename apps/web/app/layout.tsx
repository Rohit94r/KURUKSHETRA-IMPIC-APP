import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { IS_APP } from "@/lib/platform";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Layerflow — find the bug, keep the skill",
  description:
    "Layerflow is a coding coach for beginner Python programmers: it runs your code safely, explains failures in plain language, and gives hints that sharpen without ever revealing the answer.",
  openGraph: {
    title: "Layerflow — find the bug, keep the skill",
    description: "A coding coach that helps you find the bug without handing you the answer.",
  },
};

// The app draws edge to edge (content pads itself by the safe-area insets), doesn't
// pinch-zoom like a web page, and lets the keyboard shrink the layout so inputs stay visible.
export const viewport: Viewport = IS_APP
  ? { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#0a0a0a" }
  : { width: "device-width", initialScale: 1 };

// Runs before the page renders: on a reload within the same app session the opening has
// already played (hide it); otherwise drop Android's launch splash as soon as the first
// frame — the same mark in the same place — is on screen, long before React has loaded.
const SPLASH_BOOT = `try{if(sessionStorage.getItem("layerflow-splash")==="1")document.documentElement.dataset.splash="done"}catch(e){}
requestAnimationFrame(function(){requestAnimationFrame(function(){try{window.Capacitor.nativePromise("SplashScreen","hide",{fadeOutDuration:150})}catch(e){}})});`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // the app's chrome is imported only in the app build (a literal condition, so the website bundle drops it)
  const AppRoot = process.env.NEXT_PUBLIC_LAYERFLOW_APP === "1" ? (await import("@/components/native/AppRoot")).AppRoot : null;
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", fontMono.variable, inter.variable)} data-app={IS_APP ? "" : undefined}>
      {IS_APP && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOT }} />
        </head>
      )}
      <body className="bg-neutral-50 text-neutral-950 font-sans selection:bg-neutral-900 selection:text-white">
        <ThemeProvider>
          <I18nProvider>
            {AppRoot ? <AppRoot>{children}</AppRoot> : children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
