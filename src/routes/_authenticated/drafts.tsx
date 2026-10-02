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
        Soft uploads, request answers, and Organize suggestions show up here as drafts. Edit
        anything that&apos;s wrong, approve what&apos;s right, or discard it. Accept is the{" "}
        <strong>trust hinge</strong>: nothing goes on your timeline until you approve it, and
        accept does not newly share unless the draft already came from a share you chose.
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
