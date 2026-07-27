import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

type To =
  | "/journal"
  | "/evidence"
  | "/voice-notes"
  | "/timeline"
  | "/patterns"
  | "/case-builder"
  | "/court-packet"
  | "/communications"
  | "/calendar"
  | "/share-with-attorney"
  | "/court-ready"
  | "/resources";

interface Props {
  eyebrow?: string;
  title: string;
  body: string;
  cta: string;
  to: To;
}

/**
 * Cognitive close: every screen ends with one specific next step.
 * Quiet, warm card — never demanding. Use once, at the bottom of a screen.
 */
export function CognitiveClose({ eyebrow = "Your next step", title, body, cta, to }: Props) {
  return (
    <Link
      to={to}
      className="group mt-10 block rounded-3xl p-7 transition-all duration-500 hover:-translate-y-0.5"
      style={{
        background: "var(--linen, #F2E8D8)",
        border: "1px solid rgba(42,37,32,0.06)",
        boxShadow: "none",
      }}
    >
      <span className="label-eyebrow" style={{ color: "var(--primary)" }}>{eyebrow}</span>
      <h3 className="mt-3 font-serif text-[20px] leading-tight">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.78 }}>
        {body}
      </p>
      <span className="btn-primary mt-5 inline-flex items-center gap-2 text-[13px]">
        {cta} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}