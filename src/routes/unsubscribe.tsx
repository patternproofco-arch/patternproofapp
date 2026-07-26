import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
      { property: "og:description", content: "Stop receiving PatternProof emails at this address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnsubscribePage,
});

type State = "checking" | "ready" | "done" | "already" | "invalid";

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) return setState("invalid");
        if (b.reason === "already_unsubscribed") return setState("already");
        setState(b.valid ? "ready" : "invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const b = await r.json().catch(() => ({}));
      if (b.reason === "already_unsubscribed") setState("already");
      else if (b.success) setState("done");
      else setState("invalid");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#F7F5F0" }}>
      <div className="card-pp" style={{ maxWidth: 460, width: "100%" }}>
        <div className="label-eyebrow">Email preferences</div>
        {state === "checking" && <p className="mt-3 text-[14px]">One moment — checking this link…</p>}
        {state === "ready" && (
          <>
            <h1 className="mt-2 font-serif text-[24px]">Stop receiving these emails?</h1>
            <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              You&apos;ll no longer get PatternProof emails at this address. You can still sign in
              and use your account normally.
            </p>
            <button onClick={confirm} disabled={busy} className="btn-primary mt-4">
              {busy ? "One moment…" : "Confirm unsubscribe"}
            </button>
          </>
        )}
        {state === "done" && (
          <>
            <h1 className="mt-2 font-serif text-[24px]">You&apos;re unsubscribed.</h1>
            <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              We won&apos;t send further emails to this address.
            </p>
          </>
        )}
        {state === "already" && (
          <>
            <h1 className="mt-2 font-serif text-[24px]">Already taken care of.</h1>
            <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              This address is already unsubscribed.
            </p>
          </>
        )}
        {state === "invalid" && (
          <>
            <h1 className="mt-2 font-serif text-[24px]">This link isn&apos;t valid.</h1>
            <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              It may have expired or already been used. Try the link in your most recent email.
            </p>
          </>
        )}
      </div>
    </main>
  );
}