import type { ChronologyBead } from "@/components/ChronologyThread";

/** Fictional beads for /demo — same component as a live case. */
export const DEMO_BEADS: ChronologyBead[] = [
  {
    id: "d1",
    title: "School pickup message",
    happenedLabel: "About March 2026",
    certainty: "approximate",
    sourceClock: "export filename F03, no day on the message",
    savedClock: "demo fixture",
    kind: "text",
    sourceRef: "item F03",
    unresolved: "Does another record fix the day?",
    body: "Pickup time changed with less than an hour of notice.",
  },
  {
    id: "d2",
    title: "Follow-up the same week",
    happenedLabel: "Week of the pickup message",
    certainty: "approximate",
    kind: "note",
    duplicateCount: 2,
    body: "Two screenshots of the same thread. One record.",
  },
  {
    id: "d3",
    title: "Voice note after court",
    happenedLabel: "Exact time on the recording",
    certainty: "exact",
    sourceClock: "file created timestamp",
    kind: "audio",
    body: "User recorded what was said in the hallway. Date taken from the file, not guessed.",
  },
];
