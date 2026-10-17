import BountyProgramPage from "./Program";

/** Same as /challenge/[id]: the Android app ships one placeholder page and reads ?id= (bountyHref in lib/platform). */
export function generateStaticParams() {
  return process.env.NEXT_PUBLIC_LAYERFLOW_APP === "1" ? [{ id: "_" }] : [];
}

export default function BountyPage() {
  return <BountyProgramPage />;
}
