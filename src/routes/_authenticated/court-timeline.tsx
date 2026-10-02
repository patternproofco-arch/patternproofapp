import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { getMyCourtTimeline } from "@/lib/court-timeline.functions";
import { CourtTimeline } from "@/components/CourtTimeline";
import { BinderExhibits } from "@/components/BinderExhibits";
import { PleadingIndex } from "@/components/PleadingIndex";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/court-timeline")({
  head: () => ({
    meta: [
      { title: "Court timeline — PatternProof" },
      { name: "description", content: "Exactly what your attorney sees, in date order." },
      { property: "og:title", content: "Court timeline — PatternProof" },
      { property: "og:description", content: "Exactly what your attorney sees, in date order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourtTimelinePage,
});

function CourtTimelinePage() {
  const fetchTimeline = useServerFn(getMyCourtTimeline);
  const q = useQuery({ queryKey: ["my-court-timeline"], queryFn: () => fetchTimeline() });
  const hasTimelines = (q.data?.timelines.length ?? 0) > 0;
  return (
    <div>
      <div className="print:hidden">
        <HubTabs tabs={CASE_TABS} />
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <div className="label-eyebrow">Court timeline</div>
          <h1 className="mt-2 font-serif text-[30px]">
            What your attorney sees. <em>Nothing more.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground">
            Only the entries, files and answered requests you chose to share, in date order. The
            exhibit numbers match your attorney's binder.
          </p>
        </div>
        {hasTimelines && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            <Printer size={14} /> Download as PDF
          </button>
        )}
      </div>
      <div className="mt-6 space-y-10">
        {q.isLoading && <p className="text-muted-foreground">Gathering your timeline…</p>}
        {q.error && (
          <p className="text-muted-foreground">We couldn't load this. Try again in a moment.</p>
        )}
        {q.data?.timelines.length === 0 && (
          <p className="text-muted-foreground">
            You're not sharing with an attorney right now. When you are, this is where you'll see
            exactly what they see.
          </p>
        )}
        {q.data?.timelines.map((t) => (
          <section key={t.link_id} className="rounded-2xl bg-card p-5 print:rounded-none print:p-0">
            <header className="mb-4 border-b border-border pb-3">
              <h2 className="font-serif text-lg">Draft Case Summary for Professional Review</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Shared with {t.attorney} · User-reviewed, not court-verified ·{" "}
                {new Date().toLocaleDateString()}
              </p>
            </header>
            <div className="mb-6">
              <h3 className="mb-3 font-serif text-[15px]">Court timeline</h3>
              <CourtTimeline entries={t.entries} />
            </div>
            <PleadingIndex entries={t.entries} />
            <BinderExhibits entries={t.entries} />
          </section>
        ))}
      </div>
    </div>
  );
}
