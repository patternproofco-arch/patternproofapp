import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatEvidenceDate } from "@/lib/dates";

export const Route = createFileRoute("/_survivor/timeline")({
  head: () => ({
    meta: [{ title: "Timeline — Survivor Portal" }],
  }),
  component: SurvivorTimeline,
});

interface TimelineItem {
  id: string;
  date: string;
  type: "incident" | "evidence";
  title: string;
  description?: string;
  details?: string;
  file_type?: string;
}

function SurvivorTimeline() {
  const { user } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    Promise.all([
      // Fetch incidents
      supabase
        .from("incidents")
        .select("id,date,description,abuse_types")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("date", { ascending: false }),

      // Fetch evidence
      supabase
        .from("evidence")
        .select("id,title,date,file_type,description")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("date", { ascending: false }),
    ])
      .then(([incidentsRes, evidenceRes]) => {
        const timelineItems: TimelineItem[] = [];

        // Add incidents
        (incidentsRes.data || []).forEach((incident) => {
          if (incident.date) {
            timelineItems.push({
              id: `incident-${incident.id}`,
              date: incident.date,
              type: "incident",
              title: incident.abuse_types
                ? (incident.abuse_types as string[]).join(", ")
                : "Incident",
              description: incident.description || undefined,
              details: incident.description || undefined,
            });
          }
        });

        // Add evidence
        (evidenceRes.data || []).forEach((evidence) => {
          timelineItems.push({
            id: `evidence-${evidence.id}`,
            date: evidence.date || new Date().toISOString(),
            type: "evidence",
            title: evidence.title,
            description: evidence.file_type,
            file_type: evidence.file_type,
            details: evidence.description || undefined,
          });
        });

        // Sort by date descending
        timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setItems(timelineItems);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading timeline:", err);
        setLoading(false);
      });
  }, [user]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Timeline</h1>
        <p className="mt-2 text-muted-foreground">
          All your incidents and evidence, organized chronologically.
        </p>
      </div>

      {/* Timeline */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-ground p-8 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No timeline yet</h3>
          <p className="text-sm text-muted-foreground">
            Add incidents or evidence to build your timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-ground overflow-hidden"
            >
              <button
                onClick={() => toggleExpanded(item.id)}
                className="w-full px-4 py-4 flex items-start gap-4 hover:bg-muted/50 transition-colors text-left"
              >
                {/* Icon & Date */}
                <div className="flex-shrink-0 pt-1">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.type === "incident"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {item.type === "incident" ? (
                      <Calendar className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded">
                          {formatEvidenceDate(item.date)}
                        </span>
                        {item.type === "evidence" && item.file_type && (
                          <span className="text-xs text-muted-foreground">
                            {item.file_type.toUpperCase()}
                          </span>
                        )}
                        {item.type === "incident" && (
                          <span className="text-xs font-medium text-destructive px-2 py-1 bg-destructive/10 rounded">
                            Incident
                          </span>
                        )}
                      </div>
                    </div>

                    {item.details && (
                      <div className="flex-shrink-0">
                        {expandedIds.has(item.id) ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedIds.has(item.id) && item.details && (
                <div className="border-t border-border bg-muted/20 px-4 py-4">
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {item.details}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
