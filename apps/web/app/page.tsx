/**
 * The website opens on the pitch; the Android app opens on the learner's day.
 * The flag is a build-time literal, so each build only bundles its own home
 * (static imports of both would ship the website's hero videos inside the APK).
 */
export default async function Page() {
  if (process.env.NEXT_PUBLIC_LAYERFLOW_APP === "1") {
    const { AppHome } = await import("@/components/native/AppHome");
    return <AppHome />;
  } else {
    const { Hero } = await import("@/components/Hero");
    return <Hero />;
  }
}
