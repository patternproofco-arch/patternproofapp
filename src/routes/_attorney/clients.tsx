import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, FileText, MessageSquare, TrendingUp, Users } from "lucide-react";
import { listMyClients } from "@/lib/attorney-portal.functions";

export const Route = createFileRoute("/_attorney/clients")({
  component: ClientsList,
});

type ClientRow = Awaited<ReturnType<typeof listMyClients>>["clients"][number];

const riskStyle: Record<string, { bg: string; label: string }> = {
  low: { bg: "var(--safe)", label: "Low" },
  moderate: { bg: "var(--type-coercive)", label: "Moderate" },
  elevated: { bg: "var(--type-emotional)", label: "Elevated" },
  high: { bg: "var(--primary)", label: "High" },
};

function ClientsList() {
  const fetcher = useServerFn(listMyClients);
  const [clients, setClients] = useState<ClientRow[] | null>(null);

  useEffect(() => { fetcher().then((r) => setClients(r.clients)); }, [fetcher]);

  return (
    <div>
      <div className="label-eyebrow">Litigation intelligence</div>
      <h1 className="mt-2 font-serif text-[32px]">Your clients</h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Every documented incident, evidence file, and pattern from each client — organized for filing, not for reading.
      </p>

      {!clients ? (
        <div className="card-pp mt-6">Loading clients…</div>
      ) : clients.length === 0 ? (
        <div className="card-pp mt-6">
          <div className="flex items-center gap-2"><Users size={16} /><div className="font-serif text-[16px]">No clients yet</div></div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            When a survivor invites you, their case will appear here. Ask them to send you an invitation link from PatternProof.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {clients.map((c) => {
            const risk = riskStyle[c.risk_level];
            return (
              <Link
                key={c.link_id}
                to="/clients/$clientId"
                params={{ clientId: c.client_user_id }}
                className="card-pp block transition hover:opacity-90"
                style={{ borderLeft: `4px solid ${risk.bg}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-serif text-[18px]">Client · {c.client_user_id.slice(0, 8)}</div>
                    <div className="label-eyebrow mt-1">linked {new Date(c.linked_at).toLocaleDateString()}</div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: risk.bg, color: "var(--sidebar-active)" }}>
                    {risk.label} risk
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  <Stat icon={<FileText size={12} />} label="Incidents" v={c.incident_count} />
                  <Stat icon={<TrendingUp size={12} />} label="Evidence" v={c.evidence_count} />
                  <Stat icon={<AlertTriangle size={12} />} label="Active flags" v={c.escalation_flag_count} />
                </div>
                {(c.unread_messages > 0 || c.open_doc_requests > 0) && (
                  <div className="mt-3 flex items-center gap-3 text-[11px]" style={{ color: "var(--primary)" }}>
                    {c.unread_messages > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> {c.unread_messages} new</span>}
                    {c.open_doc_requests > 0 && <span>{c.open_doc_requests} doc request{c.open_doc_requests === 1 ? "" : "s"} open</span>}
                  </div>
                )}
                {c.last_incident_date && (
                  <div className="mt-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    Most recent incident: {new Date(c.last_incident_date).toLocaleDateString()}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, v }: { icon: React.ReactNode; label: string; v: number }) {
  return (
    <div>
      <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>{icon} {label}</div>
      <div className="mt-0.5 font-serif text-[20px]">{v}</div>
    </div>
  );
}