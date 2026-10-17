import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Layerflow for Android. The pages are the web app's static export
 * (apps/web/out, built by scripts/build-app.mjs) served from inside the APK at
 * https://localhost; the API is the learner's Layerflow server (Me → Server).
 */
const config: CapacitorConfig = {
  appId: "com.layerflow.app",
  appName: "Layerflow",
  webDir: "../web/out",
  backgroundColor: "#0a0a0a",
  server: {
    androidScheme: "https",
    // a dev server (the emulator's 10.0.2.2, a laptop on the LAN) is usually plain http;
    // API calls go through Android's HTTP stack (lib/app-fetch.ts), which needs this to reach it
    cleartext: true,
  },
  android: {
    // the pages are https://localhost; anything they load straight from an http server
    // (rather than through app-fetch) would otherwise be blocked as mixed content
    allowMixedContent: true,
    backgroundColor: "#0a0a0a",
  },
  plugins: {
    SplashScreen: {
      // the web splash hides this the moment it can take over; the timer is only a safety net
      launchAutoHide: true,
      launchShowDuration: 4000,
      launchFadeOutDuration: 200,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
    Keyboard: {
      // edge to edge, Android won't resize the WebView for the keyboard on its own
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_layerflow",
      iconColor: "#359462",
    },
  },
};

export default config;
