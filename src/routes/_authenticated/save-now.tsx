import { createFileRoute } from "@tanstack/react-router";
import { QuickCaptureForm } from "@/components/survivor/QuickCaptureForm";

export const Route = createFileRoute("/_authenticated/save-now")({
  head: () => ({
    meta: [
      { title: "PatternProof — Save it now" },
      { name: "description", content: "Write down what happened. Organizing it can wait." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SaveNow,
});

function SaveNow() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-eyebrow">Save now</div>
      <h1 className="mt-2 leading-tight">Write it down. <em>Sort it out later.</em></h1>
      <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Nothing here is required except a line or two. No category, no exact time,
        no explaining. You can come back and add to it whenever you want.
      </p>
      <div className="mt-6 rounded-[20px] p-5 md:p-6"
        style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--sv-shadow)" }}>
        <QuickCaptureForm />
      </div>
    </div>
  );
}
