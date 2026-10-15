import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, Paperclip, BookOpen, CalendarClock, Share2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard.functions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { RecentActivityFeed, type ActivityItem } from "@/components/RecentActivityFeed";
import { type QuickAction } from "@/components/shared/QuickActionGrid";
import { portalTheme } from "@/components/shared/portal-theme";
import { ThreadPreview, type ThreadItem } from "@/components/shared/ThreadPreview";
import { HomeGuideCard } from "@/components/survivor/HomeGuideCard";
import { HOME_VIEW_KEY, homeViewKey, quickExitTried } from "@/lib/home-guide";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — PatternProof" },
      { name: "description", content: "Add an entry and see your recent activity." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

// Familiar words, and few of them. Safety stays here, always visible.
const QUICK_ACTIONS: QuickAction[] = [
  { label: "Search", icon: BookOpen, to: "/search" },
  { label: "Entries", icon: BookOpen, to: "/journal" },
  { label: "Timeline", icon: CalendarClock, to: "/timeline" },
  { label: "Files", icon: Paperclip, to: "/evidence" },
  { label: "Sharing", icon: Share2, to: "/access" },
  { label: "Safety", icon: ShieldCheck, to: "/safety" },
  // Moved here from the header.
  { label: "PatternProof Agent", icon: BookOpen, to: "/agent" },
  { label: "Support", icon: BookOpen, to: "/support" },
];

function Dashboard() {
  const { user } = useAuth();
  const t = portalTheme("survivor");
  const statsFn = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [thread, setThread] = useState<ThreadItem[] | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  // Home defaults to one guide card; "Show everything" is remembered on this device.
  const [view, setView] = useState<"guide" | "all" | null>(null);
  const [qeTried, setQeTried] = useState(true);

  useEffect(() => {
    statsFn()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoaded(true));
  }, [statsFn]);

  useEffect(() => {
    if (!user) return;
    try {
      const saved =
        window.localStorage.getItem(homeViewKey(user.id)) ??
        window.localStorage.getItem(HOME_VIEW_KEY);
      setView(saved === "all" ? "all" : "guide");
    } catch {
      setView("guide");
    }
    setQeTried(quickExitTried());
  }, [user]);

  const chooseView = (v: "guide" | "all") => {
    setView(v);
    try {
      if (user) window.localStorage.setItem(homeViewKey(user.id), v);
    } catch {
      /* remembered for this visit only */
    }
  };

  const guideInputs = useMemo(
    () => ({
      entries: stats?.incident_count ?? 0,
      draftWaiting: (stats?.unconfirmed_ai_count ?? 0) > 0,
      // Home does not load evidence requests; this state stays off until it does.
      requestWaiting: false,
      quickExitTried: qeTried,
    }),
    [stats, qeTried],
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [inc, ev, vn] = await Promise.all([
        supabase
          .from("incidents")
          .select(
            "id,date,description,created_at,date_precision,date_range_start,date_range_end,anchor_label",
          )
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .or("source.neq.ai_extracted,confirmed_at.not.is.null")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("evidence")
          .select("id,date,title,created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("voice_notes")
          .select("id,date,title,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      const items: ActivityItem[] = [
        ...(inc.data ?? []).map((r) => ({
          id: r.id,
          kind: "mark" as const,
          at: r.created_at,
          date: r.date,
          label: (r.description ?? "").slice(0, 110) || "An entry you saved",
        })),
        ...(ev.data ?? []).map((r) => ({
          id: r.id,
          kind: "evidence" as const,
          at: r.created_at,
          date: r.date,
          label: r.title ?? "A file you added",
        })),
        ...(vn.data ?? []).map((r) => ({
          id: r.id,
          kind: "voice" as const,
          at: r.created_at,
          date: r.date,
          label: r.title ?? "A voice note",
        })),
      ]
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 10);
      setActivity(items);
      setThread(
        (inc.data ?? []).slice(0, 3).map((r) => ({
          id: r.id,
          description: r.description ?? "An entry you saved",
          date: r.date,
          date_precision: r.date_precision,
          date_range_start: r.date_range_start,
          date_range_end: r.date_range_end,
          anchor_label: r.anchor_label,
        })),
      );
    })();
  }, [user]);

  const isFirstTime =
    !!stats &&
    stats.incident_count === 0 &&
    stats.evidence_count === 0 &&
    stats.unconfirmed_ai_count === 0;

  const figures: Array<{ n: number; label: string }> = [
    { n: stats?.incident_count ?? 0, label: "notes" },
    { n: stats?.evidence_count ?? 0, label: "files" },
    { n: stats?.voice_note_count ?? 0, label: "voice notes" },
  ];

  if (view === null || !statsLoaded || !user) {
    return <div aria-busy="true" style={{ minHeight: 200 }} />;
  }

  const expanded = view === "all";
  const toggle = (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => chooseView(expanded ? "guide" : "all")}
      className="pp-home-toggle"
      data-testid="home-toggle"
    >
      {expanded ? "Show less" : "Show everything"}
    </button>
  );
  return (
    <div className="pp-home" data-view={view} style={{ display: "grid", gap: 16 }}>
      {/* Calm view: the band only. Expanded, "Show less" moves to the top. */}
      {expanded && toggle}
      <HomeGuideCard userId={user.id} inputs={guideInputs} />
      {!expanded && toggle}
      {expanded && <div className="pp-home-expanded">{renderFullHome()}</div>}
    </div>
  );

  function renderFullHome() {
    return (
      <div style={{ display: "grid", gap: 28 }}>
        <div>
          <div className="label-eyebrow">Home</div>
          <h1 className="mt-2 max-w-[640px] font-serif text-[34px] leading-tight">
            {isFirstTime ? (
              <>
                Whenever you're ready, <em>start here.</em>
              </>
            ) : (
              <>
                Add an entry, <em>then rest.</em>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-[640px] text-[14px]" style={{ color: t.muted }}>
            Start where you need to. New items stay private until you choose to share them.
          </p>

          <p className="pp-home-stats mt-4" data-testid="home-stats">
            {figures.map((f) => `${f.n} ${f.label}`).join(" · ")}
          </p>

          {/* One main action. A note, a recording or a file can all be where an entry starts. */}
          <div className="mt-5">
            <Link
              to="/journal"
              className="btn-pp"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              <Plus size={16} /> Save something
            </Link>
            <Link to="/timeline" className="btn-ghost ml-3 inline-flex items-center gap-2">
              <BookOpen size={16} /> Review my record
            </Link>
            <Link to="/access" className="btn-ghost ml-3 inline-flex items-center gap-2">
              <Share2 size={16} /> Get ready to share
            </Link>
            <p className="mt-3 text-[13px]" style={{ color: t.muted }}>
              Start with a note, or{" "}
              <Link to="/voice-notes" style={{ color: "var(--ink)", textDecoration: "underline" }}>
                a recording
              </Link>
              , or{" "}
              <Link to="/evidence" style={{ color: "var(--ink)", textDecoration: "underline" }}>
                a file
              </Link>
              . Nothing is shared unless you choose to.
            </p>
          </div>
        </div>

        {/* Holds the Safety link — never dimmed. */}
        <div>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-2"
            style={{ borderTop: "1px solid var(--rule)", paddingTop: 12 }}
          >
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                style={{ fontSize: 13, color: "var(--ink)", textDecoration: "none" }}
              >
                {a.label}
              </Link>
            ))}
            <Link
              to="/settings"
              hash="connected-apps"
              style={{ fontSize: 13, color: "var(--ink)", textDecoration: "none" }}
            >
              AI assistance
            </Link>
          </nav>
        </div>

        {thread && thread.length > 0 && (
          <div>
            <div
              style={{
                marginBottom: 10,
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: t.muted,
              }}
            >
              Your thread so far
            </div>
            <ThreadPreview variant="survivor" items={thread} to="/timeline" />
          </div>
        )}

        <div>
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
            <section style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: t.muted,
                  }}
                >
                  Recently
                </h2>
                <Link to="/journal" style={{ fontSize: 12.5, color: "var(--ink)" }}>
                  Open your entries →
                </Link>
              </div>
              <RecentActivityFeed items={activity} />
            </section>
          )}
        </div>

        <div style={{ fontSize: 12, color: t.muted }}>
          <Link to="/feedback" style={{ color: "inherit", textDecoration: "underline" }}>
            Share how PatternProof is feeling for you
          </Link>
        </div>
      </div>
    );
  }
}
