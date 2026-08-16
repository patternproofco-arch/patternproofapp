import { createFileRoute } from "@tanstack/react-router";
import { DemoShell } from "@/components/demo/DemoShell";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "PatternProof — Guided Demo (Fictional Data)" },
      { name: "description", content: "A guided walkthrough of PatternProof using a fictional case: journal, evidence, timeline, recurrence view, case builder, and court packet. No signup, no real records." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "PatternProof — Guided Demo (Fictional Data)" },
      { property: "og:description", content: "Walk the real PatternProof documentation workflow with a clearly labelled fictional case." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoShell,
});
