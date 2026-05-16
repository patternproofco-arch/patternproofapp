import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { typeLabel } from "@/lib/abuse-types";

export const Route = createFileRoute("/_authenticated/escalation-detector")({
  component: EscalationPage,
});

interface Inc { id: string; date: string; description: string; abuse_types: string[] }
interface Flag { id: string; tier: 1 | 2 | 3; text: string; incidentIds: string[] }

const TIER1 = ["strangulation", "choking", "hands around throat", "couldn't breathe", "weapon", "gun", "knife", "threatened to kill", "going to kill"];

function EscalationPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Inc[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("incidents").select("id,date,description,abuse_types").eq("user_id", user.id).order("date", { ascending: false });
      const inc = (data as Inc[] | null) ?? [];
      setIncidents(inc);

      const out: Flag[] = [];
      const t1 = inc.filter((i) => TIER1.some((k) => i.description.toLowerCase().includes(k)));
      if (t1.length) out.push({ id: "t1-keywords", tier: 1, text: "One or more incidents in your records mention strangulation, weapons, or threats to kill. Research shows these are among the most significant risk indicators in abusive relationships.", incidentIds: t1.map((i) => i.id) });
      const thirty = Date.now() - 30 * 86400000;
      const recent = inc.filter((i) => new Date(i.date).getTime() > thirty);
      if (recent.length >= 3) out.push({ id: "t2-frequency", tier: 2, text: `You have logged ${recent.length} incidents in the last 30 days. This may be worth discussing with your attorney or advocate.`, incidentIds: recent.map((i) => i.id) });
      const counts: Record<string, number> = {};
      inc.forEach((i) => i.abuse_types.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; }));
      Object.entries(counts).filter(([, n]) => n >= 3).forEach(([t, n]) => {
        out.push({ id: `t3-${t}`, tier: 3, text: `The pattern "${typeLabel(t)}" appears in ${n} of your records.`, incidentIds: [] });
      });
      setFlags(out);
    })();
  }, [user]);

  return (
    <div>
      <div className="label-eyebrow">Escalation Detector</div>
      <h1 className="mt-2 font-serif text-[34px]">What your records show.</h1>

      <div className="card-pp mt-6">
        <div className="font-serif text-[18px]">Pattern Summary</div>
        <p className="mt-2 text-[14px]">Total incidents: <strong>{incidents.length}</strong></p>
        {incidents.length > 0 && <p className="text-[14px]">Spanning {new Date(incidents[incidents.length - 1].date).toLocaleDateString()} — {new Date(incidents[0].date).toLocaleDateString()}</p>}
      </div>

      <div className="mt-6 space-y-3">
        {flags.length === 0 ? (
          <div className="card-pp"><p style={{ color: "var(--muted-foreground)" }}>As you add records, this page will identify patterns across your documentation. Check back as your case grows.</p></div>
        ) : flags.map((f) => (
          <div key={f.id} className="card-pp" style={{ borderLeft: `3px solid ${f.tier === 1 ? "#E77B56" : f.tier === 2 ? "#6A92D6" : "#A8D8B9"}` }}>
            <div className="label-eyebrow">Tier {f.tier}</div>
            <p className="mt-1 text-[14px] leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="card-pp mt-8" style={{ background: "var(--sidebar)", color: "var(--sidebar-active)" }}>
        <div className="font-serif text-[18px]">If you need help now</div>
        <p className="mt-2 text-[14px]">National DV Hotline: <strong>1-800-799-7233</strong></p>
        <p className="text-[14px]">Crisis Text Line: text <strong>START</strong> to 678-678</p>
      </div>
    </div>
  );
}