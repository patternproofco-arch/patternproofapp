import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Mic, Paperclip, BookOpen, Waves, CalendarClock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard.functions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { RecentActivityFeed, type ActivityItem } from "@/components/RecentActivityFeed";
import { PortalStatHero } from "@/components/shared/PortalStatHero";
import { QuickActionGrid, type QuickAction } from "@/components/shared/QuickActionGrid";
import { portalTheme } from "@/components/shared/portal-theme";
import { ThreadPreview, type ThreadItem } from "@/components/shared/ThreadPreview";
import { FocusRegion } from "@/components/survivor/focus-mode";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — PatternProof" },
      { name: "description", content: "Add a Mark and see your recent activity." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Log an Incident", icon: Plus, to: "/journal" },
  { label: "Evidence", icon: Paperclip, to: "/evidence" },
  { label: "Archive", icon: BookOpen, to: "/journal" },
  { label: "Recurline", icon: Waves, to: "/patterns" },
  { label: "Timeline", icon: CalendarClock, to: "/timeline" },
  { label: "Safety", icon: ShieldCheck, to: "/safety" },
];

function Dashboard() {
  const { user } = useAuth();
  const t = portalTheme("survivor");
  const statsFn = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [thread, setThread] = useState<ThreadItem[] | null>(null);

  useEffect(() => {
    statsFn()
      .then(setStats)
      .catch(() => setStats(null));
  }, [statsFn]);

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
          label: (r.description ?? "").slice(0, 110) || "A Mark you saved",
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
          description: r.description ?? "A Mark you saved",
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

  const entryCount = stats
    ? stats.incident_count + stats.evidence_count + stats.voice_note_count
    : 0;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <FocusRegion id="hero">
        <PortalStatHero
          variant="survivor"
          eyebrow="Home"
          heading={
            isFirstTime ? (
              <>
                Whenever you're ready, <em>start here.</em>
              </>
            ) : (
              <>
                Add a Mark, <em>then rest.</em>
              </>
            )
          }
          value={entryCount}
          label={entryCount === 1 ? "entry saved" : "entries saved"}
          message="One thing at a time. Everything you save stays private to you."
        >
          <Link
            to="/journal"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 999,
              background: "var(--pp-card)",
              color: t.accent,
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Plus size={16} /> Add a Mark
          </Link>
          <Link
            to="/voice-notes"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.45)",
              color: "#FFFFFF",
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Mic size={15} /> Say it out loud
          </Link>
        </PortalStatHero>
      </FocusRegion>

      {/* Holds the Safety link — never dimmed. */}
      <FocusRegion id="quick-actions" neverDim>
        <QuickActionGrid variant="survivor" actions={QUICK_ACTIONS} />
      </FocusRegion>

      {thread && thread.length > 0 && (
        <FocusRegion id="thread">
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
        </FocusRegion>
      )}

      <FocusRegion id="main">
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
              <Link
                to="/journal"
                style={{ fontSize: 12.5, color: t.accent, textDecoration: "none" }}
              >
                Open your Archive →
              </Link>
            </div>
            <RecentActivityFeed items={activity} />
          </section>
        )}
      </FocusRegion>

      <div style={{ fontSize: 12, color: t.muted }}>
        <Link to="/feedback" style={{ color: "inherit", textDecoration: "underline" }}>
          Share how PatternProof is feeling for you
        </Link>
      </div>
    </div>
  );
}
