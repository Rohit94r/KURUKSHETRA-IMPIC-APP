import ChallengeWorkspace from "./Workspace";

/**
 * The website renders any id on demand. The Android app is a static export, so
 * it ships a single placeholder page (/challenge/_) and reads ?id= instead —
 * see challengeHref in lib/platform.
 */
export function generateStaticParams() {
  return process.env.NEXT_PUBLIC_LAYERFLOW_APP === "1" ? [{ id: "_" }] : [];
}

export default function ChallengePage() {
  return <ChallengeWorkspace />;
}
