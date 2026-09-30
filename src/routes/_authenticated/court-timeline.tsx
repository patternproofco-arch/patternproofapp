import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyCourtTimeline } from "@/lib/court-timeline.functions";
import { CourtTimeline } from "@/components/CourtTimeline";

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
  return (
    <div>
      <div className="label-eyebrow">Court timeline</div>
      <h1 className="mt-2 font-serif text-[30px]">
        What your attorney sees. <em>Nothing more.</em>
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground">
        Only the entries, files and answered requests you chose to share, in date order. The
        exhibit numbers match your attorney's binder.
      </p>
      <div className="mt-6 space-y-8">
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
          <section key={t.link_id} className="rounded-2xl bg-card p-5">
            <h2 className="mb-4 font-serif text-lg">Shared with {t.attorney}</h2>
            <CourtTimeline entries={t.entries} />
          </section>
        ))}
      </div>
    </div>
  );
}
