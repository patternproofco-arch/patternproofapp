import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  PenLine, Mic, ArrowRight, NotebookPen, Paperclip, CalendarClock,
  ShieldCheck, Lock, LogOut, Repeat, Scale, Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard.functions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { RecentActivityFeed, type ActivityItem } from "@/components/RecentActivityFeed";
import { quickExit } from "@/lib/quick-exit";
import { useSettings } from "@/lib/settings-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "PatternProof — Home" },
      { name: "description", content: "Save something now, and see what you've already kept." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

const ACTIONS = [
  { to: "/save-now", label: "Write something down", hint: "A line is enough", Icon: PenLine },
  { to: "/voice-notes", label: "Say it out loud", hint: "Record a voice note", Icon: Mic },
  { to: "/evidence", label: "Add a file", hint: "Photos, screenshots, documents", Icon: Paperclip },
  { to: "/timeline", label: "See your timeline", hint: "In the order it happened", Icon: CalendarClock },
  { to: "/patterns", label: "Pattern Motion", hint: "What recurs, in your own records", Icon: Repeat },
  { to: "/case-builder", label: "Case Builder", hint: "Pull it together when ready", Icon: Scale },
] as const;

function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const statsFn = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    statsFn().then(setStats).catch(() => setStats(null));
  }, [statsFn]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [inc, ev, vn] = await Promise.all([
        supabase.from("incidents").select("id,date,description,created_at").eq("user_id", user.id).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("created_at", { ascending: false }).limit(8),
        supabase.from("evidence").select("id,date,title,created_at").eq("user_id", user.id).is("deleted_at", null).eq("is_sealed", false).order("created_at", { ascending: false }).limit(8),
        supabase.from("voice_notes").select("id,date,title,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
      ]);
      const items: ActivityItem[] = [
        ...(inc.data ?? []).map((r) => ({
          id: r.id, kind: "mark" as const, at: r.created_at, date: r.date,
          label: (r.description ?? "").slice(0, 110) || "A record you saved",
        })),
        ...(ev.data ?? []).map((r) => ({
          id: r.id, kind: "evidence" as const, at: r.created_at, date: r.date, label: r.title ?? "A file you added",
        })),
        ...(vn.data ?? []).map((r) => ({
          id: r.id, kind: "voice" as const, at: r.created_at, date: r.date, label: r.title ?? "A voice note",
        })),
      ]
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 10);
      setActivity(items);
    })();
  }, [user]);

  const isFirstTime =
    !!stats &&
    stats.incident_count === 0 &&
    stats.evidence_count === 0 &&
    stats.unconfirmed_ai_count === 0;

  return (
    <div>
      <div className="label-eyebrow">Survivor portal</div>
      <h1 className="mt-2 leading-tight">
        {isFirstTime ? <>Whenever you're ready, <em>start here.</em></> : <>Save it now. <em>Sort it out later.</em></>}
      </h1>
      <p className="mt-3 max-w-xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        One thing at a time. Everything you save stays private to your account.
      </p>

      {/* The one prominent thing on the page. */}
      <section className="pp-priority mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 style={{ margin: 0 }}>Something to write down?</h2>
            <p className="mt-1 max-w-md text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
              No category, no exact time, no explaining. If you only remember roughly when,
              that's what you say — we keep it that way.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/save-now" className="btn-primary inline-flex items-center gap-2">
              <PenLine size={16} /> Save it now
            </Link>
            <Link to="/voice-notes" className="btn-ghost inline-flex items-center gap-2">
              <Mic size={15} /> Say it out loud
            </Link>
          </div>
        </div>
      </section>

      {!isFirstTime && (
        <div className="pp-kpi-grid mt-6">
          {[
            { label: "Records saved", value: stats?.incident_count, hint: stats?.uncertain_date_count ? `${stats.uncertain_date_count} with an approximate date` : "In your own words", Icon: NotebookPen, to: "/journal" },
            { label: "Evidence items", value: stats?.evidence_count, hint: "Stored privately to you", Icon: Paperclip, to: "/evidence" },
            { label: "Voice notes", value: stats?.voice_note_count, hint: "Spoken records you saved", Icon: Mic, to: "/voice-notes" },
            { label: "Court dates (next 30 days)", value: stats?.upcoming_court_dates, hint: stats?.ever_had_court_date ? "From your own calendar" : "Nothing scheduled yet", Icon: CalendarClock, to: "/court-dates" },
          ].map(({ label, value, hint, Icon, to }) => (
            <Link key={label} to={to} className="pp-kpi" style={{ textDecoration: "none" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="pp-kpi__label">{label}</span>
                <span className="pp-kpi__icon"><Icon size={16} strokeWidth={1.9} /></span>
              </div>
              <span className="pp-kpi__value">{value ?? "—"}</span>
              <span className="pp-kpi__hint">{hint}</span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-[15px]" style={{ fontWeight: 600 }}>What would you like to do?</h2>
      <div className="pp-action-grid">
        {ACTIONS.map(({ to, label, hint, Icon }) => (
          <Link key={to} to={to} className="pp-action">
            <span className="pp-action__icon"><Icon size={18} strokeWidth={1.8} /></span>
            <span className="min-w-0">
              <span className="block text-[14px]" style={{ fontWeight: 600 }}>{label}</span>
              <span className="block text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>{hint}</span>
            </span>
          </Link>
        ))}
      </div>

      {isFirstTime ? (
        <div className="mt-8">
          <OnboardingChecklist
            counts={{
              incidents: stats?.incident_count ?? 0,
              evidence: stats?.evidence_count ?? 0,
              voiceNotes: stats?.voice_note_count ?? 0,
              hasCase: stats?.has_case ?? false,
            }}
          />
        </div>
      ) : (
        <div className="pp-dash-grid mt-6">
          <section className="pp-panel">
            <div className="pp-panel__head">
              <span className="pp-panel__title">Recent records</span>
              <Link to="/journal" className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Open your archive <ArrowRight size={13} />
              </Link>
            </div>
            <RecentActivityFeed items={activity} />
          </section>

          <div className="grid gap-4">
            <section className="pp-panel">
              <div className="pp-panel__head">
                <span className="pp-panel__title">How organized things are</span>
                <Link to="/patterns" className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Pattern Motion
                </Link>
              </div>
              <ul className="grid gap-2 text-[13px]">
                <li className="flex items-center justify-between gap-3">
                  <span>Entries waiting for your confirmation</span>
                  <strong>{stats?.unconfirmed_ai_count ?? "—"}</strong>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Details that don't line up yet</span>
                  <strong>{stats?.contradiction_count ?? "—"}</strong>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Dates you marked approximate</span>
                  <strong>{stats?.uncertain_date_count ?? "—"}</strong>
                </li>
              </ul>
              <p className="mt-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                These count how tidy your records are — nothing here measures safety, risk,
                credibility, or what any of it means.
              </p>
            </section>

            <section className="pp-panel">
              <div className="pp-panel__head">
                <span className="pp-panel__title">Requests &amp; sharing</span>
                <Link to="/record-requests" className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Open <ArrowRight size={13} />
                </Link>
              </div>
              <p className="flex items-start gap-2 text-[13px]">
                <Inbox size={15} strokeWidth={1.9} style={{ marginTop: 2, flex: "none", color: "var(--sv-purple-500)" }} />
                <span>
                  Nobody sees anything unless you approve a specific request. You can narrow it,
                  set an end date, decline it, or withdraw it later.
                </span>
              </p>
            </section>

            <section className="pp-safety-panel">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} strokeWidth={2} style={{ color: "var(--sv-purple-700)" }} />
                <span className="pp-panel__title">Safety &amp; privacy</span>
              </div>
              <p className="mt-2 text-[13px]">
                Your records are scoped to your account by row-level access controls, and stored
                files are kept in private storage. Data is encrypted in transit and at rest.
                This is not end-to-end encryption — authorized PatternProof engineers can
                technically access account contents in order to operate the service.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/settings" className="btn-ghost inline-flex items-center gap-2 text-[13px]">
                  <Lock size={14} /> Safety settings
                </Link>
                <button
                  type="button"
                  onClick={() => quickExit(settings.exitUrl)}
                  className="btn-primary inline-flex items-center gap-2 text-[13px]"
                >
                  <LogOut size={14} /> Exit safely
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      <div className="mt-10 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <Link to="/feedback" style={{ color: "inherit", textDecoration: "underline" }}>
          Share how PatternProof is feeling for you
        </Link>
      </div>
    </div>
  );
}
