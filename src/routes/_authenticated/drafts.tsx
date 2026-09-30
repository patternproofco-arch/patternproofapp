import { createFileRoute, Link } from "@tanstack/react-router";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";
import { ProposedTimelineReview } from "@/components/ProposedTimelineReview";

export const Route = createFileRoute("/_authenticated/drafts")({
  head: () => ({
    meta: [
      { title: "Drafts to review — PatternProof" },
      {
        name: "description",
        content: "Review transcribed and extracted text before anything reaches your timeline.",
      },
      { property: "og:title", content: "Drafts to review — PatternProof" },
      { property: "og:description", content: "Nothing reaches your timeline without you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DraftsPage,
});

function DraftsPage() {
  return (
    <div>
      <HubTabs tabs={CASE_TABS} />
      <div className="label-eyebrow">Drafts to review</div>
      <h1 className="mt-2 font-serif text-[30px]">
        Read it first. <em>You decide.</em>
      </h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Text read from your recordings, videos, photos and files shows up here as a draft. Edit
        anything that&apos;s wrong, approve what&apos;s right, or discard it. Nothing goes on your
        timeline until you approve it, and approved entries are marked &quot;User-reviewed.&quot;
      </p>
      <p className="mt-2 max-w-2xl text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Dates are suggestions. Check whether a date is when something happened, when the photo was
        taken, or when you uploaded it. For photo date matches, see{" "}
        <Link to="/evidence-review" style={{ textDecoration: "underline" }}>
          photo suggestions
        </Link>
        .
      </p>
      <div className="mt-6">
        <ProposedTimelineReview />
      </div>
    </div>
  );
}
