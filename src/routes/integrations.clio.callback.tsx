import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Clock, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * Clio OAuth callback — PLACEHOLDER ONLY.
 *
 * This route is scaffolded and reachable so that the Clio app registration
 * can list a valid redirect URL immediately. It intentionally does NOT
 * exchange the `code` for tokens: we are pending Clio app approval and have
 * no client credentials yet. Wire the real exchange once creds are in the
 * secrets store — the received `code` is surfaced below only for diagnostics
 * when connecting in dev.
 */
export const Route = createFileRoute("/integrations/clio/callback")({
  validateSearch: (search) =>
    z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    }).parse(search),
  component: ClioCallback,
});

function ClioCallback() {
  const { code, error } = Route.useSearch();
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#F8FAFC" }}>
      <div className="att-card" style={{ maxWidth: 520, textAlign: "center" }}>
        <Clock size={28} style={{ color: "var(--att-navy)", margin: "0 auto 10px" }} />
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, color: "var(--att-navy)" }}>
          Clio integration coming soon
        </h1>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 8, lineHeight: 1.6 }}>
          Thanks for authorizing. The Clio Manage sync is currently in review with Clio's
          developer team. Once approved, connecting your account here will import matters
          and push exports directly into Clio — no manual ZIP needed.
        </p>
        {error && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#B91C1C" }}>Clio reported: {error}</div>
        )}
        {code && (
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--att-text-2)", fontFamily: "monospace", wordBreak: "break-all" }}>
            code received ({code.slice(0, 8)}…) — no token exchange performed
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <Link to="/billing" className="att-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={13} /> Back to attorney portal
          </Link>
        </div>
      </div>
    </div>
  );
}