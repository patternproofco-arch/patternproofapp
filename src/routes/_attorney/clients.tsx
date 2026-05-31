import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, FileText, MessageSquare, TrendingUp, Users, ArrowRight } from "lucide-react";
import { listMyClients } from "@/lib/attorney-portal.functions";

export const Route = createFileRoute("/_attorney/clients")({
  component: ClientsList,
});

type ClientRow = Awaited<ReturnType<typeof listMyClients>>["clients"][number];

const RISK: Record<string, { color: string; label: string }> = {
  low:      { color: "#10B981", label: "Low" },
  moderate: { color: "#FBBF24", label: "Moderate" },
  elevated: { color: "#F59E0B", label: "Elevated" },
  high:     { color: "#EF4444", label: "High" },
};

function ClientsList() {
  const fetcher = useServerFn(listMyClients);
  const [clients, setClients] = useState<ClientRow[] | null>(null);

  useEffect(() => { fetcher().then((r) => setClients(r.clients)); }, [fetcher]);

  return (
    <div>
      <div className="att-eyebrow">Case Files</div>
      <h1 style={{ fontSize: 34, marginTop: 6, marginBottom: 6 }}>Your clients</h1>
      <p style={{ color: "var(--att-text-2)", maxWidth: 640, marginBottom: 24 }}>
        Read-only litigation portal for every survivor who has shared their PatternProof case file with you.
      </p>

      {!clients ? (
        <div className="att-card">Loading clients…</div>
      ) : clients.length === 0 ? (
        <div className="att-card" style={{ textAlign: "center", padding: 40 }}>
          <Users size={28} style={{ color: "var(--att-muted)", margin: "0 auto 10px" }} />
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>No clients yet</h2>
          <p style={{ color: "var(--att-text-2)", fontSize: 13 }}>
            When a survivor invites you, their case appears here. Ask them to send you an invitation link from PatternProof.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))" }}>
          {clients.map((c) => {
            const risk = RISK[c.risk_level];
            const caseId = `PP-${c.client_user_id.slice(0, 4).toUpperCase()}`;
            return (
              <Link
                key={c.link_id}
                to="/clients/$clientId"
                params={{ clientId: c.client_user_id }}
                className="att-card att-hover"
                style={{ borderLeft: `3px solid ${risk.color}`, textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div className="att-eyebrow">Case</div>
                    <h3 style={{ fontSize: 22, margin: "2px 0 2px" }}>Client {c.client_user_id.slice(0, 8)}</h3>
                    <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>
                      <span className="att-mono">{caseId}</span> · linked {new Date(c.linked_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="att-tag" style={{ background: `${risk.color}1A`, color: risk.color }}>
                    {risk.label}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 16 }}>
                  <Stat icon={<FileText size={12} />} label="Incidents" v={c.incident_count} />
                  <Stat icon={<TrendingUp size={12} />} label="Evidence" v={c.evidence_count} />
                  <Stat icon={<AlertTriangle size={12} />} label="Flags" v={c.escalation_flag_count} />
                </div>
                {(c.unread_messages > 0 || c.open_doc_requests > 0) && (
                  <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 11, color: "var(--att-blue)", fontWeight: 600 }}>
                    {c.unread_messages > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MessageSquare size={11} /> {c.unread_messages} new</span>}
                    {c.open_doc_requests > 0 && <span>{c.open_doc_requests} doc request{c.open_doc_requests === 1 ? "" : "s"}</span>}
                  </div>
                )}
                <div className="att-divider" />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--att-text-2)" }}>
                  <span>
                    {c.last_incident_date ? `Latest: ${new Date(c.last_incident_date).toLocaleDateString()}` : "No incidents yet"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--att-navy)", fontWeight: 600 }}>
                    Open case <ArrowRight size={12} />
                  </span>
                </div>
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
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--att-slate)", fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" }}>{icon}{label}</div>
      <div style={{ fontSize: 24, fontFamily: '"Instrument Serif", serif', marginTop: 2 }}>{v}</div>
    </div>
  );
}