import { createFileRoute, Link } from "@tanstack/react-router";
import { UploadCloud, CalendarRange, Fingerprint, Scale, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type CardTo = "/evidence" | "/timeline" | "/patterns" | "/court-packet" | "/agent" | "/settings";

interface DashCard {
  to: CardTo;
  step: string;
  title: string;
  blurb: string;
  icon: React.ReactNode;
  tint: string;        // soft glow color
  iconBg: string;      // solid icon tile bg
  iconFg: string;      // icon stroke color
  ariaLabel: string;
  luminous?: boolean;
}

function Dashboard() {
  const cards: DashCard[] = [
    {
      to: "/evidence", step: "Step 1 · Upload",
      title: "Upload Evidence",
      blurb: "Add screenshots, texts, documents, photos, or recordings.",
      icon: <UploadCloud size={26} strokeWidth={2} />,
      tint: "rgba(120, 200, 220, 0.45)", iconBg: "#2F8D85", iconFg: "#FFFFFF",
      ariaLabel: "Upload evidence",
    },
    {
      to: "/timeline", step: "Step 2 · Organize",
      title: "Timeline",
      blurb: "See incidents organized by date and pattern.",
      icon: <CalendarRange size={26} strokeWidth={2} />,
      tint: "rgba(170, 160, 230, 0.45)", iconBg: "#7C5CC4", iconFg: "#FFFFFF",
      ariaLabel: "Open timeline",
    },
    {
      to: "/patterns", step: "Step 3 · Find patterns",
      title: "Pattern Report",
      blurb: "View repeated behaviors, escalation, and abuse patterns.",
      icon: <Fingerprint size={26} strokeWidth={2} />,
      tint: "rgba(140, 210, 200, 0.45)", iconBg: "#3FA89D", iconFg: "#FFFFFF",
      ariaLabel: "Open pattern report",
    },
    {
      to: "/court-packet", step: "Step 4 · Court summary",
      title: "Court Summary",
      blurb: "Generate an attorney-ready court overview.",
      icon: <Scale size={26} strokeWidth={2} />,
      tint: "rgba(160, 180, 230, 0.45)", iconBg: "#5B7CC4", iconFg: "#FFFFFF",
      ariaLabel: "Build court summary",
    },
    {
      to: "/agent", step: "Step 5 · Ask the agent",
      title: "P4TTERN PR00F Agent",
      blurb: "Ask the agent to organize, explain, or summarize your evidence.",
      icon: <PrismIcon />,
      tint: "rgba(180, 220, 240, 0.65)", iconBg: "transparent", iconFg: "#5B7CC4",
      ariaLabel: "Open the P4TTERN PR00F agent",
      luminous: true,
    },
    {
      to: "/settings", step: "Always on",
      title: "Safety & Settings",
      blurb: "Manage PIN, privacy, and account safety.",
      icon: <ShieldCheck size={26} strokeWidth={2} />,
      tint: "rgba(170, 220, 200, 0.45)", iconBg: "#2F8D85", iconFg: "#FFFFFF",
      ariaLabel: "Open safety and settings",
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-5 py-10 md:px-10 md:py-14">
      <IridescentBackdrop />
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 max-w-3xl">
          <span className="label-eyebrow" style={{ color: "var(--teal-dark)" }}>
            Your workspace
          </span>
          <h1 className="mt-2 font-serif text-[34px] leading-[1.15] md:text-[44px]" style={{ color: "var(--foreground)" }}>
            Welcome to your <em>P4TTERN PR00F</em> workspace
          </h1>
          <p className="mt-3 text-[15px] md:text-[16px]" style={{ color: "var(--muted-foreground)" }}>
            Organize evidence, identify patterns, and prepare court-ready summaries.
          </p>
          <Link
            to="/evidence"
            aria-label="Upload evidence"
            className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(47,141,133,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(47,141,133,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "linear-gradient(135deg, #2F8D85 0%, #5B7CC4 100%)" }}
          >
            <UploadCloud size={18} /> Upload Evidence
          </Link>
        </header>

        <ol aria-label="Dashboard steps" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <li key={c.to} className="contents">
              <GlassCard card={c} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function GlassCard({ card }: { card: DashCard }) {
  return (
    <Link
      to={card.to}
      aria-label={card.ariaLabel}
      className="group relative block h-full rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CC4] focus-visible:ring-offset-2"
      style={{
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(18px) saturate(140%)",
        border: "1px solid rgba(255, 255, 255, 0.7)",
        boxShadow: `0 12px 40px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 0 ${card.tint}`,
      }}
    >
      {/* iridescent glow on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120% 80% at 0% 0%, ${card.tint} 0%, transparent 55%)`,
        }}
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-4">
          <div
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
              card.luminous ? "shadow-[0_8px_24px_rgba(91,124,196,0.35)]" : "shadow-[0_6px_18px_rgba(15,23,42,0.18)]"
            }`}
            style={{
              background: card.luminous
                ? "conic-gradient(from 140deg, #cfe8ff, #d8c8ff, #b9eee2, #cfe8ff)"
                : card.iconBg,
              color: card.iconFg,
            }}
            aria-hidden
          >
            {card.icon}
          </div>
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {card.step}
          </span>
        </div>
        <h3 className="mt-5 font-serif text-[22px] leading-tight" style={{ color: "var(--foreground)" }}>
          {card.title}
        </h3>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed" style={{ color: "#2A1A10" }}>
          {card.blurb}
        </p>
        <span
          className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--teal-dark)" }}
        >
          Open <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

/** Custom prism icon for the P4TTERN PR00F Agent — translucent iridescent
 *  cube with a hidden geometric PP and small pattern nodes around it. */
function PrismIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ppPrism" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9ED8FF" />
          <stop offset="50%" stopColor="#C9B9FF" />
          <stop offset="100%" stopColor="#9CE9D2" />
        </linearGradient>
        <linearGradient id="ppPrismFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* pattern nodes */}
      <circle cx="6" cy="10" r="1.6" fill="#7C5CC4" />
      <circle cx="42" cy="10" r="1.6" fill="#2F8D85" />
      <circle cx="6" cy="38" r="1.6" fill="#5B7CC4" />
      <circle cx="42" cy="38" r="1.6" fill="#7C5CC4" />
      <path d="M7.5 11 L17 17 M40.5 11 L31 17 M7.5 37 L17 31 M40.5 37 L31 31"
        stroke="#5B7CC4" strokeOpacity="0.45" strokeWidth="1" />
      {/* prism cube */}
      <path d="M24 6 L40 15 L40 33 L24 42 L8 33 L8 15 Z" fill="url(#ppPrism)" fillOpacity="0.55" stroke="#5B7CC4" strokeWidth="1.2" />
      <path d="M24 6 L40 15 L24 24 L8 15 Z" fill="url(#ppPrismFace)" stroke="#5B7CC4" strokeWidth="1" strokeOpacity="0.5" />
      <path d="M24 24 L24 42" stroke="#5B7CC4" strokeWidth="1" strokeOpacity="0.4" />
      {/* hidden geometric PP */}
      <path
        d="M18 18 L18 30 M18 18 L22 18 Q24 18 24 21 Q24 24 22 24 L18 24
           M26 18 L26 30 M26 18 L30 18 Q32 18 32 21 Q32 24 30 24 L26 24"
        stroke="#2F8D85" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </svg>
  );
}

/** Soft iridescent backdrop — pearl white with teal / lavender / blue-gray blooms. */
function IridescentBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #F6F8FF 0%, #EEF4F5 100%)" }} />
      <div className="absolute -left-32 -top-24 h-[420px] w-[420px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(159,216,210,0.55), transparent 65%)", filter: "blur(20px)" }} />
      <div className="absolute right-[-120px] top-[10%] h-[480px] w-[480px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(201,185,255,0.45), transparent 65%)", filter: "blur(20px)" }} />
      <div className="absolute bottom-[-160px] left-1/3 h-[520px] w-[520px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(176,206,236,0.45), transparent 65%)", filter: "blur(20px)" }} />
    </div>
  );
}