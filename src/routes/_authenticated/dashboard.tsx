import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  UploadCloud, ShieldCheck, ArrowRight,
  Sparkles, ChevronLeft, ChevronRight, Plus, AlertCircle, CalendarClock, ShieldAlert, GitCompare,
} from "lucide-react";
import {
  UploadDocIcon, TimelineDotsIcon, CalendarGridIcon,
  DotCirclePatternIcon, PpTriangleIcon, CourtSummaryIcon,
} from "@/components/icons/PpIcons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCourtDates, upsertCourtDate } from "@/lib/court-dates.functions";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard.functions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type CardTo = "/evidence" | "/timeline" | "/patterns" | "/court-packet" | "/agent" | "/settings" | "/journal";

interface DashCard {
  to: CardTo;
  step?: string;
  title: string;
  blurb: string;
  status: string;
  icon: React.ReactNode;
  tint: string;        // soft glow color
  iconBg: string;      // solid icon tile bg
  iconFg: string;      // icon stroke color
  ariaLabel: string;
  luminous?: boolean;
  featured?: boolean;
}

interface CourtDate {
  id: string;
  court_name: string;
  hearing_type: string;
  hearing_at: string;
  location: string | null;
  notes: string | null;
}

function Dashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => {
    statsFn().then(setStats).catch(() => setStats(null));
  }, [statsFn]);

  const allCards: Record<CardTo, DashCard> = {
    "/evidence": {
      to: "/evidence",
      title: "Upload Evidence",
      blurb: "Add screenshots, texts, documents, photos, or recordings.",
      status: "Start here",
      icon: <UploadDocIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(120, 200, 220, 0.45)", iconBg: "#4E8C8A", iconFg: "#FFFFFF",
      ariaLabel: "Upload evidence — start here",
      featured: true,
    },
    "/timeline": {
      to: "/timeline",
      title: "Timeline",
      blurb: "See incidents organized by date and pattern.",
      status: "Review",
      icon: <TimelineDotsIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(170, 160, 230, 0.45)", iconBg: "#5B4CD6", iconFg: "#FFFFFF",
      ariaLabel: "Open timeline",
    },
    "/patterns": {
      to: "/patterns",
      title: "Recurline",
      blurb: "See which Marks keep recurring, and how often.",
      status: "Recurline",
      icon: <DotCirclePatternIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(140, 210, 200, 0.45)", iconBg: "#3FA89D", iconFg: "#FFFFFF",
      ariaLabel: "Open pattern report",
    },
    "/agent": {
      to: "/agent",
      title: "PatternProof Agent",
      blurb: "Ask the agent to organize, explain, or summarize your evidence.",
      status: "Ask for help",
      icon: <PpTriangleIcon size={26} strokeWidth={1.9} color="#FFFFFF" />,
      tint: "rgba(180, 220, 240, 0.65)", iconBg: "#5B4CD6", iconFg: "#FFFFFF",
      ariaLabel: "Open the PatternProof agent",
      luminous: true,
    },
    "/court-packet": {
      to: "/court-packet",
      title: "Court Summary",
      blurb: "Generate an attorney-ready court overview.",
      status: "For review",
      icon: <CourtSummaryIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(160, 180, 230, 0.45)", iconBg: "#5B4CD6", iconFg: "#FFFFFF",
      ariaLabel: "Build court summary",
    },
    "/settings": {
      to: "/settings",
      title: "Safety & Settings",
      blurb: "Manage PIN, privacy, and account safety.",
      status: "Private & secure",
      icon: <ShieldCheck size={26} strokeWidth={2} />,
      tint: "rgba(170, 220, 200, 0.45)", iconBg: "#4E8C8A", iconFg: "#FFFFFF",
      ariaLabel: "Open safety and settings",
    },
    "/journal": {
      to: "/journal",
      title: "Journal",
      blurb: "Log or edit incidents in your own words.",
      status: "Your words",
      icon: <TimelineDotsIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(170, 160, 230, 0.45)", iconBg: "#5B4CD6", iconFg: "#FFFFFF",
      ariaLabel: "Open journal",
    },
  };

  const isFirstTime =
    !!stats &&
    stats.incident_count === 0 &&
    stats.evidence_count === 0 &&
    stats.unconfirmed_ai_count === 0;

  const contextualCards: DashCard[] = [];
  if (stats && !isFirstTime) {
    if (stats.unconfirmed_ai_count > 0) {
      contextualCards.push({
        to: "/journal",
        title: "Review AI-extracted incidents",
        blurb: `${stats.unconfirmed_ai_count} ${stats.unconfirmed_ai_count === 1 ? "record needs" : "records need"} your confirmation before they appear in patterns or exports.`,
        status: "Needs review",
        icon: <AlertCircle size={26} strokeWidth={1.9} />,
        tint: "rgba(230, 170, 120, 0.5)", iconBg: "#B5523A", iconFg: "#FFFFFF",
        ariaLabel: "Review AI-extracted incidents",
        featured: true,
      });
    }
    if (stats.uncertain_date_count > 0) {
      contextualCards.push({
        to: "/journal",
        title: "Resolve uncertain dates",
        blurb: `${stats.uncertain_date_count} ${stats.uncertain_date_count === 1 ? "incident has" : "incidents have"} approximate or missing dates you can refine when you're ready.`,
        status: "When you're ready",
        icon: <CalendarClock size={26} strokeWidth={1.9} />,
        tint: "rgba(180, 200, 230, 0.5)", iconBg: "#5B4CD6", iconFg: "#FFFFFF",
        ariaLabel: "Resolve uncertain dates",
      });
    }
    if (stats.contradiction_count > 0) {
      const n = stats.contradiction_count;
      contextualCards.push({
        to: "/journal",
        title: "A few same-day entries don't match",
        blurb: `${n} ${n === 1 ? "pair of entries has" : "pairs of entries have"} different times or locations on the same day. Worth a look when you have a moment.`,
        status: "Worth a look",
        icon: <GitCompare size={26} strokeWidth={1.9} />,
        tint: "rgba(200, 210, 230, 0.5)", iconBg: "#6A7FA8", iconFg: "#FFFFFF",
        ariaLabel: "Review same-day entries with different details",
      });
    }
    if (stats.unreviewed_severity_indicator_count > 0) {
      const n = stats.unreviewed_severity_indicator_count;
      contextualCards.push({
        to: "/escalation-detector" as CardTo,
        title: `${n} documented ${n === 1 ? "item needs" : "items need"} your review`,
        blurb: "Severity indicators drawn from your confirmed records. Confirm or dismiss each so your documentation reflects what actually happened.",
        status: "Review",
        icon: <ShieldAlert size={26} strokeWidth={1.9} />,
        tint: "rgba(230, 170, 120, 0.5)", iconBg: "#B5523A", iconFg: "#FFFFFF",
        ariaLabel: "Review documented severity indicators",
      });
    }
    const byLast: Record<string, CardTo> = {
      evidence: "/timeline",
      timeline: "/patterns",
      patterns: "/court-packet",
      journal: "/timeline",
    };
    const preferred: CardTo = stats.last_activity ? byLast[stats.last_activity] ?? "/timeline" : "/timeline";
    const fillers: DashCard[] = [
      allCards[preferred],
      allCards["/patterns"],
      allCards["/timeline"],
      allCards["/court-packet"],
      allCards["/agent"],
      allCards["/evidence"],
    ];
    for (const c of fillers) {
      if (contextualCards.length >= 3) break;
      if (!c) continue;
      if (contextualCards.some((existing) => existing.to === c.to && existing.title === c.title)) continue;
      contextualCards.push(c);
    }
  }

  const showCourtCalendar = !!stats && (stats.upcoming_court_dates > 0 || stats.ever_had_court_date);
  const statusLine = stats ? buildStatusLine(stats) : null;

  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-5 py-10 pb-28 md:px-10 md:py-14 md:pb-14">
      <IridescentBackdrop />
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 max-w-3xl">
          <span className="label-eyebrow" style={{ color: "var(--teal-dark)" }}>
            Your workspace
          </span>
          <h1 className="mt-2 font-serif text-[34px] leading-[1.15] md:text-[44px]" style={{ color: "var(--foreground)" }}>
            Your <em>PatternProof</em> workspace
          </h1>
          <p className="mt-3 text-[15px] md:text-[16px]" style={{ color: "var(--muted-foreground)" }}>
            {isFirstTime
              ? "Take it at your pace. This is a safe place to start."
              : "Organize evidence, track court dates, find patterns, and prepare summaries."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/evidence"
              aria-label="Upload evidence"
              className="inline-flex items-center gap-2 rounded-[2px] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(47,141,133,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(47,141,133,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ background: "#5B4CD6" }}
            >
              <UploadCloud size={18} /> Upload Evidence
            </Link>
            {!isFirstTime && (
              <Link
                to="/agent"
                aria-label="Ask PatternProof Agent"
                className="inline-flex items-center gap-2 rounded-[2px] border border-[#5B4CD6]/40 bg-white/60 px-6 py-3 text-[15px] font-semibold text-[#5B4CD6] transition-all hover:-translate-y-0.5 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CD6] focus-visible:ring-offset-2"
              >
                <Sparkles size={16} /> Ask PatternProof Agent
              </Link>
            )}
          </div>
        </header>

        {statusLine && !isFirstTime && (
          <p
            className="mb-6 rounded-[2px] px-5 py-4 text-[13px]"
            style={{
              background: "rgba(255,255,255,0.35)",
              backdropFilter: "none",
              border: "1px solid rgba(255,255,255,0.45)",
              color: "#2A1A10",
            }}
          >
            {statusLine}
          </p>
        )}

        {isFirstTime ? (
          <OnboardingChecklist
            counts={{
              incidents: stats?.incident_count ?? 0,
              evidence: stats?.evidence_count ?? 0,
              voiceNotes: stats?.voice_note_count ?? 0,
              hasCase: stats?.has_case ?? false,
            }}
          />
        ) : (
          stats && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {contextualCards.map((c, i) => (
                <div key={`${c.to}-${i}`}><GlassCard card={c} /></div>
              ))}
              {showCourtCalendar && (
                <div className="md:col-span-2 lg:col-span-1"><CourtCalendarCard /></div>
              )}
              <div className="md:col-span-2 lg:col-span-3"><GlassCard card={allCards["/settings"]} compact /></div>
            </div>
          )
        )}
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 md:hidden">
        <Link
          to="/evidence"
          aria-label="Upload evidence"
          className="flex w-full items-center justify-center gap-2 rounded-[2px] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_14px_36px_rgba(47,141,133,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: "#5B4CD6" }}
        >
          <UploadCloud size={18} /> Upload Evidence
        </Link>
      </div>
      <div className="mt-8 text-center text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <Link to="/feedback" style={{ color: "inherit", textDecoration: "underline" }}>
          Share how PatternProof is feeling for you
        </Link>
      </div>
    </div>
  );
}

function buildStatusLine(s: DashboardStats): string {
  const parts: string[] = [];
  if (s.incident_count > 0) parts.push(`${s.incident_count} ${s.incident_count === 1 ? "incident" : "incidents"} logged`);
  if (s.evidence_count > 0) parts.push(`${s.evidence_count} evidence ${s.evidence_count === 1 ? "file" : "files"} preserved`);
  if (s.unconfirmed_ai_count > 0) parts.push(`${s.unconfirmed_ai_count} awaiting your confirmation`);
  if (s.uncertain_date_count > 0) parts.push(`${s.uncertain_date_count} ${s.uncertain_date_count === 1 ? "date" : "dates"} still uncertain`);
  if (s.upcoming_court_dates > 0) parts.push(`${s.upcoming_court_dates} court ${s.upcoming_court_dates === 1 ? "date" : "dates"} in the next 30 days`);
  if (parts.length === 0) return "Nothing else needs attention today.";
  if (s.unconfirmed_ai_count === 0 && s.uncertain_date_count === 0) {
    return parts.join(" · ") + " · Nothing else needs attention today.";
  }
  return parts.join(" · ") + ".";
}

function GlassCard({ card, compact = false }: { card: DashCard; compact?: boolean }) {
  const featured = card.featured;
  return (
    <Link
      to={card.to}
      aria-label={card.ariaLabel}
      className={`group relative block h-full ${compact ? "min-h-0" : "min-h-[200px]"} rounded-[2px] p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CD6] focus-visible:ring-offset-2`}
      style={{
        background: featured
          ? "#FFFFFF"
          : "#FFFFFF",
        border: featured ? "1px solid var(--pp-accent)" : "1px solid var(--pp-hairline)",
        boxShadow: "none",
      }}
    >
      <div className={`relative flex h-full ${compact ? "flex-row items-center gap-4" : "flex-col"}`}>
        <div className={`flex ${compact ? "items-center" : "items-start justify-between"} gap-3`}>
          <div
            className={`grid ${compact ? "h-11 w-11" : "h-14 w-14"} shrink-0 place-items-center rounded-[2px]`}
            style={{ background: card.iconBg, color: card.iconFg }}
            aria-hidden
          >
            {card.icon}
          </div>
          {!compact && (
            <span
              className="rounded-[2px] px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: featured ? "#4E8C8A" : "rgba(255,255,255,0.75)",
                color: featured ? "#FFFFFF" : "#4E8C8A",
                border: featured ? "none" : "1px solid rgba(47,141,133,0.3)",
              }}
            >
              {card.status}
            </span>
          )}
        </div>
        <div className={compact ? "flex-1 min-w-0" : ""}>
          {!compact && card.step && (
            <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>
              {card.step}
            </div>
          )}
          <h3 className={`${compact ? "" : "mt-1"} font-serif ${compact ? "text-[18px]" : "text-[22px]"} leading-tight`} style={{ color: "var(--foreground)" }}>
            {card.title}
          </h3>
          <p className={`${compact ? "mt-0.5 text-[13px]" : "mt-2 text-[14px]"} leading-relaxed`} style={{ color: "#2A1A10" }}>
            {card.blurb}
          </p>
          {!compact && (
            <span
              className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold transition-transform group-hover:translate-x-0.5"
              style={{ color: featured ? "#4E8C8A" : "var(--teal-dark)" }}
            >
              {featured ? "Upload now" : "Open"} <ArrowRight size={14} />
            </span>
          )}
        </div>
        {compact && (
          <ArrowRight size={16} className="shrink-0" style={{ color: "var(--teal-dark)" }} aria-hidden />
        )}
      </div>
    </Link>
  );
}

/* ───────────────────────── Court Calendar Card ───────────────────────── */

function CourtCalendarCard() {
  const listFn = useServerFn(listCourtDates);
  const [dates, setDates] = useState<CourtDate[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [open, setOpen] = useState(false);

  const refresh = () => listFn().then((r) => setDates((r.dates ?? []) as CourtDate[])).catch(() => {});
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const datesByDay = useMemo(() => {
    const map = new Map<string, CourtDate[]>();
    for (const d of dates) {
      const k = ymd(new Date(d.hearing_at));
      const arr = map.get(k) ?? [];
      arr.push(d);
      map.set(k, arr);
    }
    return map;
  }, [dates]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return dates.filter((d) => new Date(d.hearing_at).getTime() >= now).slice(0, 3);
  }, [dates]);

  const today = ymd(new Date());

  return (
    <section
      aria-label="Court calendar"
      className="relative h-full rounded-[2px] p-6"
      style={{
        background: "rgba(255,255,255,0.2)",
        backdropFilter: "none",
        border: "1px solid rgba(255,255,255,0.45)",
        boxShadow: "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[2px] shadow-[0_6px_18px_rgba(15,23,42,0.18)]"
          style={{ background: "#5B4CD6", color: "#FFFFFF" }} aria-hidden>
          <CalendarGridIcon size={26} strokeWidth={1.9} color="#FFFFFF" />
        </div>
        <span className="rounded-[2px] border border-[#5B4CD6]/30 bg-white/75 px-2.5 py-1 text-[11px] font-semibold" style={{ color: "#5B4CD6" }}>
          Upcoming dates
        </span>
      </div>
      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>
        Court calendar
      </div>
      <h3 className="mt-1 font-serif text-[22px] leading-tight" style={{ color: "var(--foreground)" }}>
        Court Calendar
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "#2A1A10" }}>
        Track court dates, deadlines, and reminders.
      </p>

      {/* Mini calendar */}
      <div className="mt-5 rounded-[2px] bg-white/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CD6]"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{monthLabel}</div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CD6]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const has = datesByDay.has(key);
            const isToday = key === today;
            return (
              <div
                key={i}
                className="relative grid h-9 place-items-center rounded-[2px] text-[12px]"
                style={{
                  background: has ? "rgba(91,124,196,0.18)" : isToday ? "rgba(47,141,133,0.12)" : "transparent",
                  color: inMonth ? "var(--foreground)" : "rgba(0,0,0,0.25)",
                  fontWeight: has || isToday ? 700 : 500,
                  border: has ? "1px solid rgba(91,124,196,0.45)" : "1px solid transparent",
                }}
                aria-label={has ? `${d.toDateString()} — court date` : d.toDateString()}
              >
                {d.getDate()}
                {has && (
                  <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: "#5B4CD6" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="mt-4">
        {upcoming.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing scheduled. When you're ready, add a date below.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-[13px]">
                <span className="mt-1 inline-block h-2 w-2 rounded-full shrink-0" style={{ background: "#5B4CD6" }} />
                <div className="min-w-0">
                  <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(d.hearing_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="truncate" style={{ color: "var(--foreground)" }}>
                    {d.hearing_type} — {d.court_name}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add court date */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-1.5 rounded-[2px] border border-[#5B4CD6]/40 bg-white/70 px-4 py-2 text-[13px] font-semibold hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CD6]"
            style={{ color: "#5B4CD6" }}
          >
            <Plus size={14} /> Add court date
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Add a court date</DialogTitle>
          </DialogHeader>
          <AddCourtDateForm
            onSaved={() => { setOpen(false); refresh(); }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AddCourtDateForm({ onSaved }: { onSaved: () => void }) {
  const upsertFn = useServerFn(upsertCourtDate);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [hearingType, setHearingType] = useState("");
  const [notes, setNotes] = useState("");
  const [reminder, setReminder] = useState("1d");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!date || !hearingType.trim()) {
      setErr("Please add a date and hearing type.");
      return;
    }
    setSaving(true);
    try {
      const iso = new Date(`${date}T${time || "09:00"}:00`).toISOString();
      const reminderLabel: Record<string, string> = {
        none: "No reminder",
        "1h": "Remind 1 hour before",
        "1d": "Remind 1 day before",
        "3d": "Remind 3 days before",
        "1w": "Remind 1 week before",
      };
      const noteBody = [`Reminder: ${reminderLabel[reminder] ?? "1 day before"}`, notes.trim()].filter(Boolean).join("\n\n");
      await upsertFn({
        data: {
          court_name: location.trim() || "Court",
          hearing_type: hearingType.trim(),
          hearing_at: iso,
          location: location.trim() || null,
          notes: noteBody || null,
        },
      });
      onSaved();
    } catch {
      setErr("We couldn't save that. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cd-date">Date</Label>
          <Input id="cd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="cd-time">Time</Label>
          <Input id="cd-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="cd-type">Hearing type</Label>
        <Input id="cd-type" placeholder="e.g. Custody hearing" value={hearingType} onChange={(e) => setHearingType(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="cd-loc">Court location</Label>
        <Input id="cd-loc" placeholder="e.g. Bergen County Courthouse" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <Label>Reminder</Label>
        <Select value={reminder} onValueChange={setReminder}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No reminder</SelectItem>
            <SelectItem value="1h">1 hour before</SelectItem>
            <SelectItem value="1d">1 day before</SelectItem>
            <SelectItem value="3d">3 days before</SelectItem>
            <SelectItem value="1w">1 week before</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cd-notes">Notes</Label>
        <Textarea id="cd-notes" rows={3} placeholder="Anything to remember about this date." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {err && <p className="text-[13px]" style={{ color: "#B5523A" }}>{err}</p>}
      <DialogFooter>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[2px] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
          style={{ background: "#5B4CD6" }}
        >
          {saving ? "Saving…" : "Save date"}
        </button>
      </DialogFooter>
    </form>
  );
}

function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startDow = first.getDay(); // 0..6 Sun..Sat
  const start = new Date(first);
  start.setDate(first.getDate() - startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Flat paper backdrop — no decorative blooms in the locked design system. */
function IridescentBackdrop() {
  return <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "#F7F5F0" }} />;
}
