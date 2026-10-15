import threadStart from "@/assets/illustrations/thread-start.svg?raw";
import threadRest from "@/assets/illustrations/thread-rest.svg?raw";
import threadsGather from "@/assets/illustrations/threads-gather.svg?raw";
import datedSequence from "@/assets/illustrations/dated-sequence.svg?raw";
import threadsConverge from "@/assets/illustrations/threads-converge.svg?raw";
import threadGap from "@/assets/illustrations/thread-gap.svg?raw";

/** Thread illustrations (Experience v2, 2026-10-15). Decorative only; at most one per screen. */
const ART = {
  "thread-start": threadStart,
  "thread-rest": threadRest,
  "threads-gather": threadsGather,
  "dated-sequence": datedSequence,
  "threads-converge": threadsConverge,
  "thread-gap": threadGap,
} as const;

export type IllustrationName = keyof typeof ART;

export function Illustration({
  name,
  hideBelow360 = false,
  className = "",
}: {
  name: IllustrationName;
  /** Hide under 360px where the art would push a CTA below the fold at 320px. */
  hideBelow360?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pp-illo ${hideBelow360 ? "pp-illo--hide-narrow" : ""} ${className}`}
      data-illustration={name}
      // Static, bundled SVG files (no user content).
      dangerouslySetInnerHTML={{ __html: ART[name] }}
    />
  );
}
