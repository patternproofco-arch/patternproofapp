import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/unsubscribe")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Unsubscribe — PatternProof" },
      { name: "description", content: "Stop receiving PatternProof emails at this address." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Unsubscribe — PatternProof" },
      {
        property: "og:description",
        content: "Stop receiving PatternProof emails at this address.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--pp-ground)",
      }}
    >
      <div className="card-pp" style={{ maxWidth: 460, width: "100%" }}>
        <div className="label-eyebrow">Email preferences</div>
        <h1 className="mt-2 font-serif text-[24px]">Managing your email preferences</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Use the unsubscribe link at the bottom of your most recent PatternProof email to stop
          receiving these emails. You can still sign in and use your account normally.
        </p>
      </div>
    </main>
  );
}
