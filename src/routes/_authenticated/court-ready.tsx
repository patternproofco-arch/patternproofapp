import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Heart, FileDown } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_authenticated/court-ready")({
  component: CourtReadyPage,
});

function CourtReadyPage() {
  const sub = useSubscription();
  const [mode, setMode] = useState<"monthly" | "pwyc">("monthly");
  const [amount, setAmount] = useState(5);

  if (sub.tier === "court_ready") {
    return (
      <div className="card-pp space-y-3" style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
        <Check size={32} style={{ color: "var(--accent)", margin: "0 auto" }} />
        <h1 className="font-serif text-[28px]">You have Professional Review.</h1>
        <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Court packets, attorney exports, and full pattern analysis are unlocked for your account.
        </p>
        <Link to="/court-packet" className="btn-primary inline-block">Open court packet</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-2 py-6">
      <PaymentTestModeBanner />
      <div className="mb-6 mt-4">
        <p className="label-eyebrow">Professional Review</p>
        <h1 className="font-serif text-[32px] leading-tight mt-1">
          When you're ready to put it in front of someone.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
          The core app stays free, always. Professional Review adds what you need when you're going to court or working with an attorney: AI-built court packets, attorney exports, and the full pattern view.
        </p>
      </div>

      <div className="card-pp">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("monthly")}
            className={mode === "monthly" ? "btn-primary" : "btn-ghost"}
            style={{ flex: 1 }}
          >
            $10/month
          </button>
          <button
            onClick={() => setMode("pwyc")}
            className={mode === "pwyc" ? "btn-primary" : "btn-ghost"}
            style={{ flex: 1 }}
          >
            Pay what you can
          </button>
        </div>

        <ul className="space-y-2 text-[14px] mb-4">
          <li className="flex gap-2"><FileDown size={16} style={{ color: "var(--accent)", marginTop: 2 }} /> Source-linked ZIP packet with provenance and integrity report</li>
          <li className="flex gap-2"><Check size={16} style={{ color: "var(--accent)", marginTop: 2 }} /> Send your case file directly to an attorney</li>
          <li className="flex gap-2"><Check size={16} style={{ color: "var(--accent)", marginTop: 2 }} /> Full pattern analysis + escalation arc</li>
          <li className="flex gap-2"><Heart size={16} style={{ color: "var(--accent)", marginTop: 2 }} /> Cancel any time. Keep access through the paid period.</li>
        </ul>

        {mode === "pwyc" && (
          <div className="mb-4">
            <label className="label-eyebrow">One-time amount (USD)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={500}
                step={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min={1}
                max={500}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="input-pp"
                style={{ width: 100, textAlign: "right" }}
              />
            </div>
            <p className="text-[12px] mt-2" style={{ color: "var(--muted-foreground)" }}>
              One-time payment unlocks Professional Review features. Whatever you can give helps keep the core app free for everyone.
            </p>
          </div>
        )}

        <div style={{ border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
          {mode === "monthly" ? (
            <StripeEmbeddedCheckout
              priceId="court_ready_monthly"
              returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/court-ready-thanks?session_id={CHECKOUT_SESSION_ID}`}
            />
          ) : (
            <StripeEmbeddedCheckout
              customAmountCents={amount * 100}
              returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/court-ready-thanks?session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}