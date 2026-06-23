import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ExternalLink, Lock, Star } from "lucide-react";
import { createPortalSession } from "@/lib/payments.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

export const Route = createFileRoute("/_attorney/billing")({
  component: BillingPage,
});

type TierKey = "solo" | "firm" | "enterprise";
const TIERS: Array<{ key: TierKey; name: string; price: string; per: string; bullets: string[]; recommended?: boolean }> = [
  { key: "solo", name: "Solo", price: "$297", per: "/mo", bullets: ["5 active client files", "Court-ready ZIP exports", "Pattern + deposition prep", "Private attorney notes"] },
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
    <div style={{ display: "grid", gap: 20, maxWidth: 1080, margin: "0 auto" }}>
      <div>
        <div className="att-eyebrow">Billing</div>
        <h1 style={{ fontSize: 32, fontFamily: '"Instrument Serif", serif', marginTop: 4 }}>Plan &amp; payment</h1>
      </div>

      <div className="att-card" style={{ background: sub.isActive ? "#F0FDF4" : "#FEF2F2", borderColor: sub.isActive ? "#86EFAC" : "#FCA5A5" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="att-eyebrow" style={{ color: sub.isActive ? "#166534" : "#991B1B" }}>
              {sub.isActive ? "Active subscription" : "No active subscription"}
            </div>
            <div style={{ fontSize: 22, fontFamily: '"Instrument Serif", serif', marginTop: 4 }}>
              {sub.isActive
                ? `P4TTERN PR00F ${currentTier === "firm" ? "Firm" : currentTier === "enterprise" ? "Enterprise" : currentTier === "solo" ? "Solo" : "Plan"}`
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
                  border: isCurrent ? "2px solid var(--att-navy)" : t.recommended ? "2px solid var(--att-green)" : "1px solid var(--att-border)",
                  background: isCurrent ? "#F8FAFC" : "var(--att-surface)",
                }}
              >
                {t.recommended && !isCurrent && (
                  <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, background: "var(--att-green)", color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Star size={10} /> Recommended
                  </span>
                )}
                {isCurrent && (
                  <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, background: "var(--att-navy)", color: "#fff" }}>Current</span>
                )}
                <div className="att-eyebrow">{t.name}</div>
                <div style={{ fontSize: 30, fontFamily: '"Instrument Serif", serif', marginTop: 4 }}>
                  {t.price}<span style={{ fontSize: 13, color: "var(--att-text-2)" }}>{t.per}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, marginTop: 14, display: "grid", gap: 8, fontSize: 13 }}>
                  {t.bullets.map((b) => (
                    <li key={b} style={{ display: "flex", gap: 8 }}>
                      <Check size={14} style={{ color: "var(--att-green)", marginTop: 2, flexShrink: 0 }} /> <span>{b}</span>
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

      <div className="att-card" style={{ background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--att-text-2)" }}>
        <Lock size={14} /> Cards never touch our servers. Billing handled end-to-end by Stripe.
      </div>
    </div>
  );
}