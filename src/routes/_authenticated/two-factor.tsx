import { createFileRoute } from "@tanstack/react-router";
import { TwoFactorCard } from "@/components/TwoFactorCard";

export const Route = createFileRoute("/_authenticated/two-factor")({
  head: () => ({
    meta: [
      { title: "Two-factor authentication — PatternProof" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TwoFactorPage,
});

function TwoFactorPage() {
  return (
    <div>
      <div className="label-eyebrow">Settings</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Two-factor <em>authentication.</em>
      </h1>
      <TwoFactorCard className="card-pp mt-8" />
    </div>
  );
}
