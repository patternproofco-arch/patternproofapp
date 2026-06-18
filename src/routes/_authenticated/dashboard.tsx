import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowRight, Calendar as CalendarIcon, CheckCircle2, Circle, Download,
  FileText, PenLine, ShieldCheck, Sparkles, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePinLock } from "@/lib/pin-lock";
import { useSettings } from "@/lib/settings-context";
import { typeColor, typeLabel } from "@/lib/abuse-types";
import { upcomingCourtDates } from "@/lib/court-dates.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface LatestPattern { summary: string }
interface RecentIncident { id: string; date: string; description: string | null; abuse_types: string[] | null; location: string | null }
interface CourtDateRow { id: string; court_name: string; hearing_type: string; hearing_at: string; location: string | null }

function Dashboard() {
  const { user } = useAuth();
  const { hasPin } = usePinLock();
  const { settings } = useSettings();
  const courtDatesFn = useServerFn(upcomingCourtDates);
  const [counts, setCounts] = useState({ incidents: 0, evidence: 0, voiceNotes: 0, months: 0 });
  const [recent, setRecent] = useState<RecentIncident[]>([]);
  const [pattern, setPattern] = useState<LatestPattern | null>(null);
  const [hearings, setHearings] = useState<CourtDateRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [recentRes, allInc, ev, vn, pat] = await Promise.all([
        supabase.from("incidents").select("id,date,abuse_types,description,location").eq("user_id", user.id).order("date", { ascending: false }).limit(3),
        supabase.from("incidents").select("date", { count: "exact" }).eq("user_id", user.id).order("date", { ascending: true }).limit(1),
        supabase.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("voice_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("pattern_analyses").select("analysis,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      ]);
      setRecent((recentRes.data ?? []) as RecentIncident[]);
      const earliestDate = allInc.data?.[0]?.date ?? null;
      const patRow = pat.data?.[0] as { analysis: { pattern_summary?: string }; created_at: string } | undefined;
      if (patRow?.analysis?.pattern_summary) {
        setPattern({ summary: patRow.analysis.pattern_summary });
      }
      const months = earliestDate
        ? Math.max(1, Math.round((Date.now() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : 0;
      setCounts({ incidents: allInc.count ?? 0, evidence: ev.count ?? 0, voiceNotes: vn.count ?? 0, months });
      setLoaded(true);
    })();
    courtDatesFn().then((r) => setHearings((r.dates ?? []) as CourtDateRow[])).catch(() => {});
  }, [user, courtDatesFn]);

  const safety = [
    { key: "pin",       label: "4-digit code set",                done: hasPin },
    { key: "exit",      label: "I know where Quick Exit is",      done: settings.onboarded },
    { key: "notif",     label: "Notifications kept private",      done: !settings.notificationsEnabled },
    { key: "incident",  label: "First incident logged",           done: counts.incidents > 0 },
    { key: "evidence",  label: "At least one piece of evidence",  done: counts.evidence > 0 },
  ];
  const safetyDone = safety.filter((s) => s.done).length;

  return (
    <div className="min-h-[calc(100vh-5rem)] px-5 py-8 md:px-10 md:py-12"
         style={{ opacity: loaded ? 1 : 0, transition: "opacity 500ms ease" }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 max-w-3xl">
          <h1 className="font-serif text-[36px] leading-[1.15] md:text-[44px]">
            You're building your case,
            <br />
            <em>one record at a time.</em>
          </h1>
        </header>

        {/* Primary CTA */}
        <Link to="/journal" className="block">
          <div className="card-pp mb-6 flex items-center justify-between gap-6"
            style={{ borderLeft: "4px solid var(--primary)", padding: 28 }}>
            <div>
              <span className="label-eyebrow" style={{ color: "var(--primary)" }}>Log an incident</span>
              <h2 className="font-serif text-[24px] mt-1">Add what happened today</h2>
              <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                A few sentences is enough. You can come back and add more later.
              </p>
            </div>
            <span className="btn-primary inline-flex items-center gap-2 whitespace-nowrap">
              <PenLine size={14} /> Begin
            </span>
          </div>
        </Link>

        {/* Card grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AgentCard />
          <RecentTimelineCard rows={recent} />
          <PatternCard pattern={pattern} count={counts.incidents} />
          <CourtDatesCard rows={hearings} />
          <ExportCard incidentCount={counts.incidents} />
          <SafetyChecklistCard items={safety} done={safetyDone} />
          <StatsCard counts={counts} />
        </div>
      </div>
    </div>
  );
}

function CardShell({
  eyebrow, title, accent = "var(--primary)", to, children, action,
}: {
  eyebrow: string; title: string; accent?: string;
  to?: "/timeline" | "/patterns" | "/court-dates" | "/court-packet" | "/settings" | "/agent";
  children: React.ReactNode;
  action?: { label: string; to: string };
}) {
  const Wrap: React.ComponentType<{ children: React.ReactNode; className?: string }> = to
    ? ({ children, className }) => <Link to={to} className={className}>{children}</Link>
    : ({ children, className }) => <div className={className}>{children}</div>;
  return (
    <Wrap className="card-pp card-lift block h-full" >
      <div className="flex h-full flex-col" style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 14 }}>
        <span className="label-eyebrow" style={{ color: accent }}>{eyebrow}</span>
        <h3 className="mt-2 font-serif text-[18px] leading-tight">{title}</h3>
        <div className="mt-3 flex-1 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          {children}
        </div>
        {action && (
          <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: accent }}>
            {action.label} <ArrowRight size={13} />
          </span>
        )}
      </div>
    </Wrap>
  );
}

function RecentTimelineCard({ rows }: { rows: RecentIncident[] }) {
  return (
    <CardShell
      eyebrow="Recent timeline"
      title="What you've recorded lately"
      accent="var(--purple-dark)"
      to="/timeline"
      action={{ label: "Open timeline", to: "/timeline" }}
    >
      {rows.length === 0 ? (
        <p>Nothing here yet — when you're ready, this is a safe place to start.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const firstType = r.abuse_types?.[0];
            return (
              <li key={r.id} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full" style={{ background: firstType ? typeColor(firstType) : "var(--muted-foreground)" }} />
                <div className="min-w-0">
                  <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(r.date).toLocaleDateString()}{firstType && ` · ${typeLabel(firstType)}`}
                  </div>
                  <div className="truncate text-[13px]" style={{ color: "var(--foreground)" }}>
                    {r.description || "—"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}

function PatternCard({ pattern, count }: { pattern: LatestPattern | null; count: number }) {
  return (
    <CardShell
      eyebrow="Pattern insights"
      title={pattern ? "Latest pattern detected" : "Patterns will appear here"}
      accent="var(--primary)"
      to="/patterns"
      action={{ label: "Open analysis", to: "/patterns" }}
    >
      {pattern ? (
        <p className="line-clamp-4">{pattern.summary}</p>
      ) : (
        <p>{count < 2
          ? "Log a few entries and we'll begin gently surfacing patterns and escalation markers."
          : "Ready to see what your records reveal?"}</p>
      )}
      <div className="mt-2 inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        <Sparkles size={12} /> Private to you
      </div>
    </CardShell>
  );
}

function CourtDatesCard({ rows }: { rows: CourtDateRow[] }) {
  return (
    <CardShell
      eyebrow="Upcoming court dates"
      title={rows.length ? "What's coming up" : "Nothing on the calendar"}
      accent="var(--purple-dark)"
      to="/court-dates"
      action={{ label: rows.length ? "Open calendar" : "Add a date", to: "/court-dates" }}
    >
      {rows.length === 0 ? (
        <p>Track hearings, status conferences, and TRO dates here so nothing slips.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              <CalendarIcon size={14} className="mt-0.5" style={{ color: "var(--purple-dark)" }} />
              <div className="min-w-0">
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {new Date(r.hearing_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </div>
                <div className="truncate text-[13px]" style={{ color: "var(--foreground)" }}>
                  {r.hearing_type} — {r.court_name}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function ExportCard({ incidentCount }: { incidentCount: number }) {
  return (
    <CardShell
      eyebrow="Court-ready exports"
      title="Build a report"
      accent="var(--teal-dark)"
      to="/court-packet"
      action={{ label: "Choose an export", to: "/court-packet" }}
    >
      {incidentCount === 0 ? (
        <p>Once you have a few records, you can generate a timeline, evidence packet, or attorney brief here.</p>
      ) : (
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2"><FileText size={13} /> Timeline PDF</li>
          <li className="flex items-center gap-2"><Download size={13} /> Evidence packet</li>
          <li className="flex items-center gap-2"><FileText size={13} /> Attorney brief</li>
        </ul>
      )}
    </CardShell>
  );
}

function SafetyChecklistCard({ items, done }: {
  items: { key: string; label: string; done: boolean }[];
  done: number;
}) {
  return (
    <CardShell
      eyebrow="Safety checklist"
      title={`${done} of ${items.length} steps in place`}
      accent="var(--primary)"
      to="/settings"
      action={{ label: "Open settings", to: "/settings" }}
    >
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.key} className="flex items-center gap-2 text-[13px]">
            {it.done
              ? <CheckCircle2 size={14} style={{ color: "var(--primary)" }} />
              : <Circle size={14} style={{ color: "var(--muted-foreground)" }} />}
            <span style={{ color: it.done ? "var(--foreground)" : "var(--muted-foreground)" }}>{it.label}</span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function StatsCard({ counts }: { counts: { incidents: number; evidence: number; voiceNotes: number; months: number } }) {
  return (
    <CardShell eyebrow="Your record" title="What you've built so far" accent="var(--teal-dark)">
      <div className="grid grid-cols-2 gap-4">
        <Stat value={counts.incidents} label="Incidents" />
        <Stat value={counts.evidence} label="Evidence" />
        <Stat value={counts.voiceNotes} label="Voice notes" />
        <Stat value={counts.months} label={counts.months === 1 ? "Month secured" : "Months secured"} />
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        <Clock size={12} /> Encrypted, only you can read it
      </div>
    </CardShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-serif text-[26px] leading-none" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}