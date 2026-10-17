# Layerflow for Android

The Layerflow app — the same pages as the website, rebuilt into a native Android
shell with Capacitor 8: an animated opening, a bottom tab bar with Priya in the
middle, native back button, haptics, a daily streak reminder, pull to refresh,
share, deep links and an offline indicator.

## Build and open

```bash
npm install
npm run app:open          # export the web app → sync into android/ → open Android Studio
```

Then press **Run ▶** in Android Studio (an emulator or a USB-connected phone).

| Command | What it does |
|---|---|
| `npm run app:build` | export `apps/web` as static files (`apps/web/out`) and sync them into `apps/mobile/android` |
| `npm run app:open` | the same, then open the project in Android Studio |
| `npm run app:build -- --server http://192.168.1.5:3000` | bake in a different default server |
| `npm run app:build -- --no-sync` | export only (for checking the pages in a browser) |

Requirements: Node 22.13+, Android Studio (its bundled JDK 21 is what Gradle uses), Android SDK 36.

## The server

The pages ship inside the APK; the API (sandbox, hints, progress) is your Layerflow
server — `npm start` at the repo root. The app's default is `http://10.0.2.2:3000`,
which is how the **Android emulator** reaches `npm start` on the same computer.

- **A real phone:** connect it to the same Wi-Fi, then in the app go to **Me → Server**
  and enter your computer's LAN address (e.g. `http://192.168.1.5:3000`) → **Test** → **Save**.
  Or bake it in: `npm run app:build -- --server http://192.168.1.5:3000`.
- **A deployed server:** use its URL (https recommended), e.g. `--server https://layerflow.example.com`.
- The API allows the app's origin (`https://localhost`) for CORS. To allow more origins,
  set `LAYERFLOW_CORS_ORIGINS=https://a.example,https://b.example` on the server.

## Release build

1. Create a key once: `keytool -genkey -v -keystore layerflow-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias layerflow`
2. Put it in `apps/mobile/android/` and add `apps/mobile/android/keystore.properties` (git-ignored):
   ```properties
   storeFile=layerflow-release.jks
   storePassword=…
   keyAlias=layerflow
   keyPassword=…
   ```
3. Bump `versionCode` / `versionName` in `android/app/build.gradle`, build with a production
   server baked in (`--server https://…`), then **Build → Generate Signed App Bundle** in Android
   Studio (or `./gradlew bundleRelease`).
4. For an https-only server you can remove `android:usesCleartextTraffic` from the manifest and
   `cleartext` / `allowMixedContent` from `capacitor.config.ts`.

## How it fits together

```
apps/web  ──next build (NEXT_PUBLIC_LAYERFLOW_APP=1, output: export)──▶  apps/web/out
                                                                            │ cap sync
apps/mobile/android  ◀──────────────────────────────────────────────────────┘
   MainActivity        clean URLs: /dashboard → dashboard.html inside the APK
   WebView (https://localhost) ──fetch /api/* ──▶  your Layerflow server (Me → Server)
```

- **One codebase.** Everything app-only is behind `IS_APP` (`apps/web/lib/platform.ts`), a
  build-time constant — the website bundle doesn't contain it.
- **App shell** — `apps/web/components/native/`: `AppSplash` (opening animation), `TabBar`,
  `AppChrome` (back button, deep links, keyboard, network, notifications, system bars, toasts),
  `AppHome` (Home tab), `MeScreen` (Me tab), `PullToRefresh`. The shared `AppShell` switches to a
  native top bar in the app; the Ask Priya chat becomes a bottom sheet.
- **Native helpers** — `apps/web/lib/native.ts` (haptics, share, Custom Tabs, streak reminders,
  back-button handlers); every helper is a no-op on the website.
- **Dynamic pages** — a static export can't pre-render every challenge id, so the app ships one
  placeholder page and passes the id in the query: `/challenge/_?id=last-k-total`
  (`challengeHref` / `bountyHref`).
- **Deep links** — `layerflow://challenge/<id>`, `layerflow://practice`, … open the app on that screen.
- **Icons & splash** — drawn from the brand mark: `node scripts/make-assets.mjs && npm run assets`.
