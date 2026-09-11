import { ChronologyThread } from "@/components/ChronologyThread";
import { DEMO_BEADS } from "@/lib/demo-beads";

/** Drop in place of the old demo Timeline rail. */
export function TimelineTab() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ChronologyThread beads={DEMO_BEADS} />
    </div>
  );
}
