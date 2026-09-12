import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, FileText, Zap, Shield, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatEvidenceDate } from "@/lib/dates";

export const Route = createFileRoute("/_survivor/")({
  head: () => ({
    meta: [{ title: "Home — Survivor Portal" }],
  }),
  component: SurvivorHome,
});

interface Matter {
  id: string;
  matter_name: string;
  attorney_name: string;
  created_at: string;
}

interface RecentEvidence {
  id: string;
  title: string;
  date: string | null;
  file_type: string;
}

function SurvivorHome() {
  const { user } = useAuth();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [recentEvidence, setRecentEvidence] = useState<RecentEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ incidents: 0, evidence: 0, matters: 0 });

  useEffect(() => {
    if (!user) return;

    Promise.all([
      // Fetch matters (shared cases from attorneys)
      supabase
        .from("attorney_survivor_invites")
        .select("id,matter_name,attorney_name,created_at")
        .eq("survivor_email", user.email)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(3),

      // Fetch recent evidence
      supabase
        .from("evidence")
        .select("id,title,date,file_type")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),

      // Fetch stats
      supabase
        .from("incidents")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
        .is("deleted_at", null),

      supabase
        .from("evidence")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
        .is("deleted_at", null),
    ])
      .then(([mattersRes, evidenceRes, incidentsRes, evidenceCountRes]) => {
        if (mattersRes.data) setMatters(mattersRes.data);
        if (evidenceRes.data) setRecentEvidence(evidenceRes.data);
        setStats({
          incidents: incidentsRes.count || 0,
          evidence: evidenceCountRes.count || 0,
          matters: mattersRes.data?.length || 0,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading home data:", err);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-muted rounded-lg w-48" />
          <div className="h-5 bg-muted rounded w-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">
          Your evidence and timeline are here when you need them.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-ground p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Incidents</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{stats.incidents}</div>
            </div>
            <Calendar className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-ground p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Evidence Items</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{stats.evidence}</div>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-ground p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Cases</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{stats.matters}</div>
            </div>
            <Shield className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </div>
      </div>

      {/* Cases Section */}
      {matters.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Your Cases</h2>
          <div className="space-y-2">
            {matters.map((matter) => (
              <Link
                key={matter.id}
                to={`/survivor/case/${matter.id}`}
                className="block rounded-lg border border-border bg-ground p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{matter.matter_name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      Attorney: {matter.attorney_name}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-2 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Evidence */}
      {recentEvidence.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Recent Evidence</h2>
            <Link to="/survivor/timeline" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentEvidence.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-ground p-3">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.date ? formatEvidenceDate(item.date) : "No date"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center">
        <Zap className="h-8 w-8 text-primary mx-auto mb-3" />
        <h3 className="font-semibold text-foreground mb-2">Add More Evidence</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Capture photos, audio, and documents. Our AI helps organize them into a timeline.
        </p>
        <Link to="/survivor/capture" className="pp-btn pp-btn-primary inline-block">
          Start Capturing
        </Link>
      </div>
    </div>
  );
}
