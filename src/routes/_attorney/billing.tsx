import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Lock, Star, Plug, Clock } from "lucide-react";
import { createPortalSession } from "@/lib/payments.functions";
import { getClioStatus, startClioConnect, disconnectClio } from "@/lib/clio.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

export const Route = createFileRoute("/_attorney/billing")({
  component: BillingPage,
});

type TierKey = "solo" | "firm" | "enterprise";
const TIERS: Array<{ key: TierKey; name: string; price: string; per: string; bullets: string[]; recommended?: boolean }> = [
  { key: "solo", name: "Solo", price: "$297", per: "/mo", bullets: ["5 active client files", "Professional-review ZIP exports", "Pattern + deposition prep", "Private attorney notes"] },
  { key: "firm", name: "Firm", price: "$697", per: "/mo", recommended: true, bullets: ["Up to 3 attorneys", "Unlimited client files", "Priority intake support", "Shared deposition prep"] },
  { key: "enterprise", name: "Enterprise", price: "$1,497", per: "/mo", bullets: ["Unlimited attorneys", "White-label survivor portal", "SSO + dedicated audits", "Direct line to our team"] },
];

function BillingPage() {
  const sub = useSubscription();
  const portalFn = useServerFn(createPortalSession);
  const [opening, setOpening] = useState(false);

  const openPortal = async () => {
    setOpening(true);
    try {
      const env = (import.meta.env.VITE_STRIPE_ENV as "live" | "sandbox") ?? "sandbox";
      const r = await portalFn({ data: { environment: env, returnUrl: window.location.href } });
      if ("url" in r) window.location.href = r.url;
      else toast("Couldn't open billing portal: " + r.error);
    } catch { toast("Couldn't open billing portal."); }
    finally { setOpening(false); }
  };

  if (sub.loading) return <div className="att-card">Loading billing…</div>;

  const currentTier = sub.tier;
  const renews = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1080 }}>
      <div>
        <div className="att-eyebrow">Billing</div>
        <h1 className="att-page-title">Plan &amp; payment</h1>
      </div>

      <div className="att-card" style={{ background: "var(--att-surface)", borderLeft: "2px solid var(--att-navy)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="att-eyebrow" style={{ color: "var(--att-slate)" }}>
              {sub.isActive ? "Active subscription" : "No active subscription"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
              {sub.isActive
                ? `PatternProof ${currentTier === "firm" ? "Firm" : currentTier === "enterprise" ? "Enterprise" : currentTier === "solo" ? "Solo" : "Plan"}`
                : "Pick a plan to unlock case files"}
            </div>
            {sub.isActive && (
              <div style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 4 }}>
                Status: {sub.status}
                {renews && <> · {sub.cancelAtPeriodEnd ? "ends" : "renews"} {renews.toLocaleDateString()}</>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {sub.isActive ? (
              <button className="att-btn-primary" onClick={openPortal} disabled={opening} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={13} /> {opening ? "Opening…" : "Manage in Stripe"}
              </button>
            ) : (
              <Link to="/subscribe" className="att-btn-primary">Choose a plan</Link>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="att-eyebrow" style={{ marginBottom: 10 }}>Compare plans</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
          {TIERS.map((t) => {
            const isCurrent = sub.isActive && currentTier === t.key;
            return (
              <div
                key={t.key}
                className="att-card"
                style={{
                  position: "relative",
                  border: "1px solid var(--att-border)",
                  borderLeft: isCurrent || t.recommended ? "2px solid var(--att-navy)" : "1px solid var(--att-border)",
                  background: "var(--att-surface)",
                }}
              >
                {t.recommended && !isCurrent && (
                  <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, border: "1px solid var(--att-accent-border)", color: "var(--att-navy)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Star size={10} /> Recommended
                  </span>
                )}
                {isCurrent && (
                  <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, background: "var(--att-navy)", color: "#fff" }}>Current</span>
                )}
                <div className="att-eyebrow">{t.name}</div>
                <div className="att-mono" style={{ fontSize: 26, marginTop: 4 }}>
                  {t.price}<span style={{ fontSize: 13, color: "var(--att-text-2)" }}>{t.per}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, marginTop: 14, display: "grid", gap: 8, fontSize: 13 }}>
                  {t.bullets.map((b) => (
                    <li key={b} style={{ display: "flex", gap: 8 }}>
                      <Check size={14} style={{ color: "var(--att-navy)", marginTop: 2, flexShrink: 0 }} /> <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 14 }}>
                  {isCurrent ? (
                    <button className="att-btn-secondary" disabled style={{ width: "100%" }}>On this plan</button>
                  ) : sub.isActive ? (
                    <button className="att-btn-secondary" onClick={openPortal} disabled={opening} style={{ width: "100%" }}>
                      Switch in Stripe
                    </button>
                  ) : (
                    <Link to="/subscribe" className="att-btn-primary" style={{ display: "block", textAlign: "center" }}>
                      Start {t.name}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="att-card" style={{ background: "var(--att-surface-2)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--att-text-2)" }}>
        <Lock size={14} /> Cards never touch our servers. Billing handled end-to-end by Stripe.
      </div>

      <div className="att-card" style={{ marginTop: 16 }}>
        <div className="att-eyebrow">Exports</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center", marginTop: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 2, background: "var(--att-surface-2)", border: "1px solid var(--att-border)", display: "grid", placeItems: "center", color: "var(--att-navy)" }}>
            <Plug size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--att-text)" }}>Case management import package</div>
            <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 2 }}>
              Each client case file exports a ZIP of CSVs plus every evidence file, ready to import
              into your practice management system.
            </div>
          </div>
        </div>
      </div>

      <ClioPanel />
    </div>
  );
}

type ClioState =
  | { connected: false }
  | { connected: true; firmName: string | null; email: string | null; connectedAt: string };

function ClioPanel() {
  const statusFn = useServerFn(getClioStatus);
  const connectFn = useServerFn(startClioConnect);
  const disconnectFn = useServerFn(disconnectClio);
  const [state, setState] = useState<ClioState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState((await statusFn({})) as ClioState);
    } catch {
      setState({ connected: false });
    }
  }, [statusFn]);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("clio") === "connected") toast("Connected to Clio.");
    if (params.get("clio") === "error") toast(params.get("reason") || "We couldn't finish connecting Clio.");
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await connectFn({});
      window.location.href = url;
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't start the Clio connection.");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectFn({});
      toast("Clio disconnected. Your ZIP exports still work.");
      await load();
    } catch {
      toast("We couldn't disconnect Clio. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="att-card" id="clio">
      <div className="att-eyebrow">Clio connection</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 2, background: "var(--att-surface-2)", border: "1px solid var(--att-border)", display: "grid", placeItems: "center", color: "var(--att-navy)" }}>
            <Plug size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--att-text)" }}>
              {state?.connected ? `Connected to Clio${state.firmName ? ` as ${state.firmName}` : ""}` : "Clio"}
            </div>
            <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 2 }}>
              {state === null
                ? "Checking connection…"
                : state.connected
                  ? `${state.email ?? "Signed in"} · connected ${new Date(state.connectedAt).toLocaleDateString()}`
                  : "Link your Clio account. The ZIP import package stays available either way."}
            </div>
          </div>
        </div>
        <div>
          {state?.connected ? (
            <button className="att-btn-secondary" onClick={disconnect} disabled={busy}>
              {busy ? "Working…" : "Disconnect"}
            </button>
          ) : (
            <button className="att-btn-primary" onClick={connect} disabled={busy || state === null}>
              {busy ? "Opening Clio…" : "Connect to Clio"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}