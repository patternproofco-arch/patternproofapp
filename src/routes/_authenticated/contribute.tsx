import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Heart } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_authenticated/contribute")({
  component: ContributePage,
});

function ContributePage() {
  const sub = useSubscription();
  const [amount, setAmount] = useState(5);

  if (sub.tier === "court_ready") {
    return (
      <div
        className="card-pp space-y-3"
        style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}
      >
        <Check size={32} style={{ color: "var(--accent)", margin: "0 auto" }} />
        <h1 className="font-serif text-[28px]">Thank you for contributing.</h1>
        <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Your contribution is recorded. It doesn't change your account — every survivor feature,
          including your court packet, exports, and attorney sharing, was already free and stays
          free.
        </p>
        <Link to="/court-packet" className="btn-primary inline-block">
          Open court packet
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-2 py-6">
      <PaymentTestModeBanner />
      <div className="mb-6 mt-4">
        <p className="label-eyebrow">Optional contribution</p>
        <h1 className="font-serif text-[32px] leading-tight mt-1">
          Only if it helped, and only if you can.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
          Every survivor feature — your case, pattern summary, court packet, exports, and attorney
          sharing — is free, and contributing does not unlock anything extra. This page exists only
          for people who want to help keep it free for someone else.
        </p>
      </div>

      <div className="card-pp">
        <ul className="space-y-2 text-[14px] mb-4">
          <li className="flex gap-2">
            <Heart size={16} style={{ color: "var(--accent)", marginTop: 2 }} /> A one-time
            contribution — no subscription, no renewal
          </li>
          <li className="flex gap-2">
            <Check size={16} style={{ color: "var(--accent)", marginTop: 2 }} /> Nothing in the app
            is locked, before or after
          </li>
        </ul>

        <p className="text-[13px] mb-4" style={{ color: "var(--muted-foreground)" }}>
          Your court packet and attorney sharing stay free whether or not you do this.{" "}
          <Link to="/court-packet" style={{ textDecoration: "underline" }}>
            Open your packet
          </Link>
          .
        </p>

        {
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
              A one-time payment. It unlocks nothing — whatever you can give helps keep the app free
              for everyone.
            </p>
          </div>
        }

        <div style={{ boxShadow: "var(--pp-shadow-sm)", borderRadius: 18, overflow: "hidden" }}>
          <StripeEmbeddedCheckout
            customAmountCents={amount * 100}
            returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/contribute-thanks?session_id={CHECKOUT_SESSION_ID}`}
          />
        </div>
      </div>
    </div>
  );
}
