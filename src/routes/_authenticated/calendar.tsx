import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { IncidentHeatMap } from "@/components/IncidentHeatMap";
import { CognitiveClose } from "@/components/CognitiveClose";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Array<{ date: string; severity_level: number | null; has_escalation_flag: boolean }>>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("incidents")
        .select("date,severity_level,has_escalation_flag")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      setIncidents((data ?? []).filter((r): r is { date: string; severity_level: number | null; has_escalation_flag: boolean } => !!r.date));
    })();
  }, [user]);

  return (
    <div>
      <div className="label-eyebrow">Calendar view</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">When it happens. <em>How often.</em></h1>
      <p className="mt-3 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Each square is a day. Darker squares mean more incidents that day. Red tints mark days you flagged as escalation.
      </p>
      <div className="card-pp mt-6">
        <IncidentHeatMap incidents={incidents} months={12} />
      </div>
      <CognitiveClose
        title="A dense cluster is worth a closer look"
        body="Open your patterns view to see frequency, tactics, and gaps across the record you've built."
        cta="Open patterns"
        to="/patterns"
      />
    </div>
  );
}