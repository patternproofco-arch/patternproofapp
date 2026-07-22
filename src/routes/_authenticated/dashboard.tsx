import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  UploadCloud, ShieldCheck, ArrowRight,
  Sparkles, ChevronLeft, ChevronRight, Plus, AlertCircle, CalendarClock,
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
  const cards: DashCard[] = [
    {
      to: "/evidence", step: "Step 1 · Upload",
      title: "Upload Evidence",
      blurb: "Add screenshots, texts, documents, photos, or recordings.",
      status: "Start here",
      icon: <UploadDocIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(120, 200, 220, 0.45)", iconBg: "#2F8D85", iconFg: "#FFFFFF",
      ariaLabel: "Upload evidence — start here",
      featured: true,
    },
    {
      to: "/timeline", step: "Step 2 · Review",
      title: "Timeline",
      blurb: "See incidents organized by date and pattern.",
      status: "Builds as you add evidence",
      icon: <TimelineDotsIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(170, 160, 230, 0.45)", iconBg: "#7C5CC4", iconFg: "#FFFFFF",
      ariaLabel: "Open timeline",
    },
    {
      to: "/patterns", step: "Step 4 · Patterns",
      title: "Pattern Detection",
      blurb: "View repeated behaviors, escalation, and abuse patterns.",
      status: "Pattern detection",
      icon: <DotCirclePatternIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(140, 210, 200, 0.45)", iconBg: "#3FA89D", iconFg: "#FFFFFF",
      ariaLabel: "Open pattern report",
    },
    {
      to: "/agent", step: "Step 5 · Ask the agent",
      title: "PatternProof Agent",
      blurb: "Ask the agent to organize, explain, or summarize your evidence.",
      status: "Ask for help",
      icon: <PpTriangleIcon size={26} strokeWidth={1.9} color="#FFFFFF" />,
      tint: "rgba(180, 220, 240, 0.65)", iconBg: "#5B7CC4", iconFg: "#FFFFFF",
      ariaLabel: "Open the PatternProof agent",
      luminous: true,
    },
    {
      to: "/court-packet", step: "Step 6 · Court summary",
      title: "Court Summary",
      blurb: "Generate an attorney-ready court overview.",
      status: "Attorney-ready",
      icon: <CourtSummaryIcon size={26} strokeWidth={1.9} />,
      tint: "rgba(160, 180, 230, 0.45)", iconBg: "#5B7CC4", iconFg: "#FFFFFF",
      ariaLabel: "Build court summary",
    },
    {
      to: "/settings", step: "Always on",
      title: "Safety & Settings",
      blurb: "Manage PIN, privacy, and account safety.",
      status: "Private & secure",
      icon: <ShieldCheck size={26} strokeWidth={2} />,
      tint: "rgba(170, 220, 200, 0.45)", iconBg: "#2F8D85", iconFg: "#FFFFFF",
      ariaLabel: "Open safety and settings",
    },
  ];

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
            Organize evidence, track court dates, find patterns, and prepare summaries.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/evidence"
              aria-label="Upload evidence"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(47,141,133,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(47,141,133,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ background: "linear-gradient(135deg, #2F8D85 0%, #5B7CC4 100%)" }}
            >
              <UploadCloud size={18} /> Upload Evidence
            </Link>
            <Link
              to="/agent"
              aria-label="Ask PatternProof Agent"
              className="inline-flex items-center gap-2 rounded-full border border-[#5B7CC4]/40 bg-white/60 px-6 py-3 text-[15px] font-semibold text-[#5B7CC4] backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CC4] focus-visible:ring-offset-2"
            >
              <Sparkles size={16} /> Ask PatternProof Agent
            </Link>
          </div>
        </header>

        {/* Helper strip */}
        <div
          role="note"
          className="mb-8 flex items-start gap-3 rounded-2xl px-5 py-4"
          style={{
            background: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(14px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.45)",
            boxShadow: "0 6px 20px rgba(15,23,42,0.05)",
          }}
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #2F8D85, #5B7CC4)" }}
          >
            <Info size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              Start with evidence.
            </div>
            <p className="mt-0.5 text-[13px]" style={{ color: "#2A1A10" }}>
              PatternProof will help organize it into timelines, patterns, court dates, and summaries.
            </p>
          </div>
        </div>

        <ol aria-label="Dashboard steps" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Step 1 */}
          <li><GlassCard card={cards[0]} /></li>
          {/* Step 2 */}
          <li><GlassCard card={cards[1]} /></li>
          {/* Step 3 — Court Calendar (inline) */}
          <li className="md:col-span-2 lg:col-span-1"><CourtCalendarCard /></li>
          {/* Step 4 */}
          <li><GlassCard card={cards[2]} /></li>
          {/* Step 5 — Agent */}
          <li><GlassCard card={cards[3]} /></li>
          {/* Step 6 */}
          <li><GlassCard card={cards[4]} /></li>
          {/* Settings — small */}
          <li className="md:col-span-2 lg:col-span-3"><GlassCard card={cards[5]} compact /></li>
        </ol>

        {/* Agent supporting line */}
        <p
          className="mt-6 flex items-center justify-center gap-2 text-center text-[13px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Sparkles size={14} style={{ color: "#5B7CC4" }} />
          Turn scattered evidence into patterns, timelines, and professional-review insight.
        </p>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 md:hidden">
        <Link
          to="/evidence"
          aria-label="Upload evidence"
          className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-semibold text-white shadow-[0_14px_36px_rgba(47,141,133,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: "linear-gradient(135deg, #2F8D85 0%, #5B7CC4 100%)" }}
        >
          <UploadCloud size={18} /> Upload Evidence
        </Link>
      </div>
    </div>
  );
}

function GlassCard({ card, compact = false }: { card: DashCard; compact?: boolean }) {
  const featured = card.featured;
  return (
    <Link
      to={card.to}
      aria-label={card.ariaLabel}
      className={`group relative block h-full ${compact ? "min-h-0" : "min-h-[200px]"} rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CC4] focus-visible:ring-offset-2`}
      style={{
        background: featured
          ? "linear-gradient(135deg, rgba(47,141,133,0.22), rgba(91,124,196,0.18))"
          : "rgba(255, 255, 255, 0.2)",
        backdropFilter: "blur(18px) saturate(140%)",
        border: featured ? "1.5px solid rgba(47,141,133,0.45)" : "1px solid rgba(255, 255, 255, 0.45)",
        boxShadow: featured
          ? "0 14px 38px rgba(47,141,133,0.22), inset 0 1px 0 rgba(255,255,255,0.7)"
          : `0 8px 26px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.7)`,
      }}
    >
      <div className={`relative flex h-full ${compact ? "flex-row items-center gap-4" : "flex-col"}`}>
        <div className={`flex ${compact ? "items-center" : "items-start justify-between"} gap-3`}>
          <div
            className={`grid ${compact ? "h-11 w-11" : "h-14 w-14"} shrink-0 place-items-center rounded-2xl`}
            style={{ background: card.iconBg, color: card.iconFg }}
            aria-hidden
          >
            {card.icon}
          </div>
          {!compact && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: featured ? "#2F8D85" : "rgba(255,255,255,0.75)",
                color: featured ? "#FFFFFF" : "#2F8D85",
                border: featured ? "none" : "1px solid rgba(47,141,133,0.3)",
              }}
            >
              {card.status}
            </span>
          )}
        </div>
        <div className={compact ? "flex-1 min-w-0" : ""}>
          {!compact && (
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
              style={{ color: featured ? "#2F8D85" : "var(--teal-dark)" }}
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
      className="relative h-full rounded-3xl p-6"
      style={{
        background: "rgba(255,255,255,0.2)",
        backdropFilter: "blur(18px) saturate(140%)",
        border: "1px solid rgba(255,255,255,0.45)",
        boxShadow: "0 8px 26px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.7)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-[0_6px_18px_rgba(15,23,42,0.18)]"
          style={{ background: "#5B7CC4", color: "#FFFFFF" }} aria-hidden>
          <CalendarGridIcon size={26} strokeWidth={1.9} color="#FFFFFF" />
        </div>
        <span className="rounded-full border border-[#5B7CC4]/30 bg-white/75 px-2.5 py-1 text-[11px] font-semibold" style={{ color: "#5B7CC4" }}>
          Upcoming dates
        </span>
      </div>
      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>
        Step 3 · Court calendar
      </div>
      <h3 className="mt-1 font-serif text-[22px] leading-tight" style={{ color: "var(--foreground)" }}>
        Court Calendar
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "#2A1A10" }}>
        Track court dates, deadlines, and reminders.
      </p>

      {/* Mini calendar */}
      <div className="mt-5 rounded-2xl bg-white/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CC4]"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{monthLabel}</div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CC4]"
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
                className="relative grid h-9 place-items-center rounded-lg text-[12px]"
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
                  <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: "#5B7CC4" }} />
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
                <span className="mt-1 inline-block h-2 w-2 rounded-full shrink-0" style={{ background: "#5B7CC4" }} />
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
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#5B7CC4]/40 bg-white/70 px-4 py-2 text-[13px] font-semibold backdrop-blur hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CC4]"
            style={{ color: "#5B7CC4" }}
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
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #2F8D85 0%, #5B7CC4 100%)" }}
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