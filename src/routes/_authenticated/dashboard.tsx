import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Mic, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard.functions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { RecentActivityFeed, type ActivityItem } from "@/components/RecentActivityFeed";

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

function Dashboard() {
  const { user } = useAuth();
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
        supabase.from("incidents").select("id,date,description,created_at").eq("user_id", user.id).is("deleted_at", null).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("created_at", { ascending: false }).limit(8),
        supabase.from("evidence").select("id,date,title,created_at").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
        supabase.from("voice_notes").select("id,date,title,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
      ]);
      const items: ActivityItem[] = [
        ...(inc.data ?? []).map((r) => ({
          id: r.id, kind: "mark" as const, at: r.created_at, date: r.date,
          label: (r.description ?? "").slice(0, 110) || "A Mark you saved",
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
      <div className="label-eyebrow">Home</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        {isFirstTime ? <>Whenever you're ready, <em>start here.</em></> : <>Add a Mark, <em>then rest.</em></>}
      </h1>
      <p className="mt-3 max-w-xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        One thing at a time. Everything you save stays private to you.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/journal" className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Add a Mark
        </Link>
        <Link to="/voice-notes" className="btn-ghost inline-flex items-center gap-2">
          <Mic size={15} /> Say it out loud
        </Link>
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
        <div className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="label-eyebrow">Recently</h2>
            <Link to="/journal" className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Open your Archive <ArrowRight size={13} />
            </Link>
          </div>
          <RecentActivityFeed items={activity} />
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
