import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  PenLine, Mic, Paperclip, CalendarClock, NotebookPen, Repeat,
  ShieldCheck, Lock, LogOut, Inbox, Home, User, LifeBuoy, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard.functions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import {
  PortalHeader, HeroStatCard, IconTileGrid, RecentActivityFeed, PortalBottomTabBar,
  type PortalVariant,
} from "@/components/shared";
import type { SharedActivityItem } from "@/components/shared/RecentActivityFeed";
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

const VARIANT: PortalVariant = "survivor";

const TABS = [
  { icon: Home as LucideIcon, label: "Home", href: "/dashboard" },
  { icon: CalendarClock as LucideIcon, label: "Timeline", href: "/timeline" },
  { icon: Paperclip as LucideIcon, label: "Evidence", href: "/evidence" },
  { icon: Repeat as LucideIcon, label: "Patterns", href: "/patterns" },
  { icon: User as LucideIcon, label: "Profile", href: "/settings" },
];

const WEEKS = 8;

function startOfWeek(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - c.getDay());
  return c;
}

function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const statsFn = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<SharedActivityItem[] | null>(null);
  const [incidentDates, setIncidentDates] = useState<string[] | null>(null);

  useEffect(() => {
    statsFn().then(setStats).catch(() => setStats(null));
  }, [statsFn]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [inc, ev, vn, trend] = await Promise.all([
        supabase.from("incidents").select("id,date,description,created_at").eq("user_id", user.id).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("created_at", { ascending: false }).limit(8),
        supabase.from("evidence").select("id,date,title,created_at").eq("user_id", user.id).is("deleted_at", null).eq("is_sealed", false).order("created_at", { ascending: false }).limit(8),
        supabase.from("voice_notes").select("id,date,title,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
        supabase.from("incidents").select("created_at").eq("user_id", user.id).is("deleted_at", null).eq("is_sealed", false).order("created_at", { ascending: false }).limit(500),
      ]);

      const items: SharedActivityItem[] = [
        ...(inc.data ?? []).map((r) => ({
          id: `mark-${r.id}`, icon: NotebookPen as LucideIcon, timestamp: r.created_at,
          title: (r.description ?? "").slice(0, 110) || "A record you saved",
          subtitle: "Record", href: "/journal",
        })),
        ...(ev.data ?? []).map((r) => ({
          id: `ev-${r.id}`, icon: Paperclip as LucideIcon, timestamp: r.created_at,
          title: r.title ?? "A file you added", subtitle: "Evidence", href: "/evidence",
        })),
        ...(vn.data ?? []).map((r) => ({
          id: `vn-${r.id}`, icon: Mic as LucideIcon, timestamp: r.created_at,
          title: r.title ?? "A voice note", subtitle: "Voice note", href: "/voice-notes",
        })),
      ]
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
        .slice(0, 5);

      setActivity(items);
      setIncidentDates((trend.data ?? []).map((r) => r.created_at as string));
    })();
  }, [user]);

  const { sparkline, deltaLabel, deltaDirection } = useMemo(() => {
    if (!incidentDates) return { sparkline: [] as number[], deltaLabel: undefined, deltaDirection: "flat" as const };
    const now = new Date();
    const thisWeek = startOfWeek(now);
    const buckets = new Array(WEEKS).fill(0) as number[];
    let thisMonth = 0;
    let lastMonth = 0;
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const mPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    for (const iso of incidentDates) {
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= m0) thisMonth += 1;
      else if (t >= mPrev) lastMonth += 1;
      const weeksAgo = Math.floor((thisWeek.getTime() - startOfWeek(new Date(t)).getTime()) / (7 * 86400_000));
      if (weeksAgo >= 0 && weeksAgo < WEEKS) buckets[WEEKS - 1 - weeksAgo] += 1;
    }

    let label: string | undefined;
    let dir: "up" | "down" | "flat" = "flat";
    if (lastMonth > 0) {
      const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
      dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
      label = `${pct > 0 ? "+" : ""}${pct}% vs last month`;
    } else if (thisMonth > 0) {
      label = `${thisMonth} this month`;
      dir = "up";
    }
    return { sparkline: buckets, deltaLabel: label, deltaDirection: dir };
  }, [incidentDates]);

  const isFirstTime =
    !!stats &&
    stats.incident_count === 0 &&
    stats.evidence_count === 0 &&
    stats.unconfirmed_ai_count === 0;

  const tiles = [
    { icon: PenLine as LucideIcon, label: "Log an Incident", href: "/save-now" },
    { icon: Paperclip as LucideIcon, label: "Evidence", href: "/evidence", count: stats?.evidence_count },
    { icon: NotebookPen as LucideIcon, label: "Journal", href: "/journal", count: stats?.incident_count },
    { icon: Repeat as LucideIcon, label: "Patterns", href: "/patterns" },
    { icon: CalendarClock as LucideIcon, label: "Timeline", href: "/timeline", count: stats?.upcoming_court_dates },
    { icon: LifeBuoy as LucideIcon, label: "Safety Plan", href: "/safety" },
  ];

  return (
    <div className="pb-24 md:pb-0">
      <PortalHeader
        variant={VARIANT}
        subtitle="SURVIVOR PORTAL"
        greeting="Welcome back,"
        subline={
          isFirstTime
            ? "Whenever you're ready, start here. One thing at a time — everything you save stays private to your account."
            : "Save it now, sort it out later. One thing at a time — everything you save stays private to your account."
        }
      />

      <div className="mt-6">
        <HeroStatCard
          variant={VARIANT}
          label="My Timeline"
          value={stats?.incident_count ?? "—"}
          caption="Records you've saved"
          deltaLabel={deltaLabel}
          deltaDirection={deltaDirection}
          sparklineData={sparkline}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/save-now" className="btn-primary inline-flex items-center gap-2">
          <PenLine size={16} /> Save it now
        </Link>
        <Link to="/voice-notes" className="btn-ghost inline-flex items-center gap-2">
          <Mic size={15} /> Say it out loud
        </Link>
      </div>

      <h2 className="mt-8 mb-3 text-[15px]" style={{ fontWeight: 600 }}>What would you like to do?</h2>
      <IconTileGrid variant={VARIANT} items={tiles} />

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
        <div className="mt-8">
          <RecentActivityFeed variant={VARIANT} items={activity} viewAllHref="/journal" />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="pp-panel">
          <div className="pp-panel__head">
            <span className="pp-panel__title">Requests &amp; sharing</span>
            <Link to="/record-requests" className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Open
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

      <div className="mt-10 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <Link to="/feedback" style={{ color: "inherit", textDecoration: "underline" }}>
          Share how PatternProof is feeling for you
        </Link>
      </div>

      <PortalBottomTabBar variant={VARIANT} items={TABS} />
    </div>
  );
}
