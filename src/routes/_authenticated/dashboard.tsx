import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ArrowRight, PenLine, Paperclip, Mic, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { IncidentCard, type IncidentLite } from "@/components/IncidentCard";
import { IncidentHeatMap } from "@/components/IncidentHeatMap";
import { WhyCourtsStruggleModal } from "@/components/WhyCourtsStruggleModal";
import { FirstTimeEducationModal } from "@/components/FirstTimeEducationModal";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface LatestPattern { summary: string; createdAt: string }

function Dashboard() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentLite[]>([]);
  const [allIncidents, setAllIncidents] = useState<Array<{ date: string; severity_level: number | null; has_escalation_flag: boolean }>>([]);
  const [counts, setCounts] = useState({ incidents: 0, evidence: 0, voiceNotes: 0, months: 0 });
  const [earliest, setEarliest] = useState<string | null>(null);
  const [latestEntry, setLatestEntry] = useState<string | null>(null);
  const [hasCase, setHasCase] = useState(false);
  const [pattern, setPattern] = useState<LatestPattern | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [recent, allInc, ev, vn, heat, caseRow, pat] = await Promise.all([
        supabase.from("incidents").select("id,date,abuse_types,description,location").eq("user_id", user.id).order("date", { ascending: false }).limit(3),
        supabase.from("incidents").select("date", { count: "exact" }).eq("user_id", user.id).order("date", { ascending: true }).limit(1),
        supabase.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("voice_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("incidents").select("date,severity_level,has_escalation_flag").eq("user_id", user.id),
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("pattern_analyses").select("analysis,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      ]);
      setIncidents((recent.data as IncidentLite[] | null) ?? []);
      setAllIncidents(heat.data ?? []);
      const earliestDate = allInc.data?.[0]?.date ?? null;
      setEarliest(earliestDate);
      setLatestEntry((recent.data?.[0] as { date?: string } | undefined)?.date ?? null);
      setHasCase((caseRow.count ?? 0) > 0);
      const patRow = pat.data?.[0] as { analysis: { pattern_summary?: string }; created_at: string } | undefined;
      if (patRow?.analysis?.pattern_summary) {
        setPattern({ summary: patRow.analysis.pattern_summary, createdAt: patRow.created_at });
      }
      const months = earliestDate
        ? Math.max(1, Math.round((Date.now() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : 0;
      setCounts({ incidents: allInc.count ?? 0, evidence: ev.count ?? 0, voiceNotes: vn.count ?? 0, months });
    })();
  }, [user]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isEmpty = counts.incidents === 0 && counts.evidence === 0 && counts.voiceNotes === 0;

  return (
    <div>
      <WhyCourtsStruggleModal />
      <FirstTimeEducationModal />
      <div className="label-eyebrow">{today}</div>
      <h1 className="mt-3 font-serif text-[34px] leading-tight md:text-[42px]">
        You're building your case.
        <br />
        <em>One record at a time.</em>
      </h1>
      <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted-foreground)" }}>
        Your documentation is private, organized, and ready when you need it.
      </p>

      {isEmpty ? (
        <div className="mt-8">
          <OnboardingChecklist counts={{ incidents: counts.incidents, evidence: counts.evidence, voiceNotes: counts.voiceNotes, hasCase }} />
        </div>
      ) : (
        <>
          <QuickActions />
          <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Incidents" value={counts.incidents} accent="var(--primary)" />
            <StatCard label="Evidence" value={counts.evidence} accent="var(--accent)" />
            <StatCard label="Voice notes" value={counts.voiceNotes} accent="var(--gold)" />
            <StatCard label="Months" value={counts.months} accent="var(--safe)" />
            <LastEntryCard date={latestEntry} />
          </div>
        </>
      )}

      {allIncidents.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-[22px]">Frequency over time</h2>
            <Link to="/calendar" className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
              Full calendar <ArrowRight size={13} className="inline" />
            </Link>
          </div>
          <div className="card-pp">
            <IncidentHeatMap incidents={allIncidents} months={6} />
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-[22px]">Recent incidents</h2>
            <Link to="/journal" className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
              View all <ArrowRight size={13} className="inline" />
            </Link>
          </div>
          {incidents.length === 0 ? (
            <div className="card-pp">
              <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                Nothing here yet — when you're ready, this is a safe place to start.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((i) => <IncidentCard key={i.id} incident={i} />)}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--sidebar)", color: "var(--sidebar-active)" }}
          >
            <h3 className="font-serif text-[22px] leading-tight">Something just happened.</h3>
            <p className="mt-2 text-[13px]" style={{ color: "var(--sidebar-inactive)" }}>
              Document it now, while the details are clear.
            </p>
            <Link to="/journal" className="btn-primary mt-4 inline-block">
              Log an Incident
            </Link>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--panel)", color: "var(--sidebar-active)" }}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} style={{ color: "var(--safe)" }} />
              <div className="text-[13px] leading-relaxed">
                Only you can see this. Your data is encrypted and never shared.
              </div>
            </div>
          </div>

          <PatternPanel pattern={pattern} incidentCount={counts.incidents} />
          {!isEmpty && <NextStep counts={counts} earliest={earliest} />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card-pp" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="label-eyebrow">{label}</div>
      <div className="mt-2 font-serif text-[36px] leading-none">{value}</div>
    </div>
  );
}

function LastEntryCard({ date }: { date: string | null }) {
  const rel = date ? relativeDate(date) : "—";
  return (
    <div className="card-pp" style={{ borderLeft: "3px solid var(--muted-foreground)" }}>
      <div className="label-eyebrow">Last entry</div>
      <div className="mt-2 font-serif text-[20px] leading-tight">{rel}</div>
    </div>
  );
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function QuickActions() {
  const items: Array<{ to: "/journal" | "/evidence" | "/voice-notes"; label: string; Icon: typeof PenLine }> = [
    { to: "/journal", label: "Log incident", Icon: PenLine },
    { to: "/evidence", label: "Upload evidence", Icon: Paperclip },
    { to: "/voice-notes", label: "Record voice note", Icon: Mic },
  ];
  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {items.map(({ to, label, Icon }) => (
        <Link key={to} to={to} className="btn-ghost inline-flex items-center gap-2 text-[13px]">
          <Icon size={14} /> {label}
        </Link>
      ))}
    </div>
  );
}

function PatternPanel({ pattern, incidentCount }: { pattern: LatestPattern | null; incidentCount: number }) {
  if (!pattern && incidentCount < 2) return null;
  if (pattern) {
    return (
      <div className="card-pp" style={{ borderLeft: "3px solid var(--accent)" }}>
        <div className="flex items-center gap-2"><Sparkles size={14} style={{ color: "var(--accent)" }} /><div className="label-eyebrow">Latest pattern analysis</div></div>
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed">{pattern.summary}</p>
        <Link to="/patterns" className="mt-3 inline-block text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
          Open analysis <ArrowRight size={13} className="inline" />
        </Link>
      </div>
    );
  }
  return (
    <div className="card-pp" style={{ borderLeft: "3px solid var(--accent)" }}>
      <div className="label-eyebrow">Pattern analysis</div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Ready to see what your records reveal?
      </p>
      <Link to="/patterns" className="mt-3 inline-block text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
        Run analysis <ArrowRight size={13} className="inline" />
      </Link>
    </div>
  );
}

function NextStep({ counts, earliest }: { counts: { incidents: number; evidence: number }; earliest: string | null }) {
  let title = "Add a piece of evidence";
  let body = "Screenshots, voice memos, documents — link them to incidents.";
  let to: "/journal" | "/evidence" | "/case-builder" | "/court-packet" = "/evidence";
  if (counts.incidents === 0) { title = "Log your first incident"; body = "When you're ready. There is no wrong way to start."; to = "/journal"; }
  else if (counts.evidence === 0) { title = "Add your first piece of evidence"; body = "A screenshot, message, or photo. Anything that documents what happened."; to = "/evidence"; }
  else if (earliest) { title = "Build your case packet"; body = "Compile your records into a court-ready document."; to = "/case-builder"; }
  return (
    <div className="card-pp">
      <div className="label-eyebrow">Next step</div>
      <h3 className="mt-2 font-serif text-[18px]">{title}</h3>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>{body}</p>
      <Link to={to} className="mt-3 inline-block text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
        Continue <ArrowRight size={13} className="inline" />
      </Link>
    </div>
  );
}