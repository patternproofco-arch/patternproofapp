import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, FileText, MessageSquare, TrendingUp, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { listMyClients } from "@/lib/attorney-portal.functions";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_attorney/clients/")({
  component: ClientsIndex,
});

type ClientRow = Awaited<ReturnType<typeof listMyClients>>["clients"][number];

const RISK: Record<string, { color: string; label: string }> = {
  low: { color: "#10B981", label: "Low" },
  moderate: { color: "#FBBF24", label: "Moderate" },
  elevated: { color: "#F59E0B", label: "Elevated" },
  high: { color: "#EF4444", label: "High" },
};

function ClientsIndex() {
  const fetcher = useServerFn(listMyClients);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const sub = useSubscription();

  useEffect(() => { fetcher().then((r) => setClients(r.clients)); }, [fetcher]);

  return (
    <div>
      <div className="att-eyebrow">Case Files</div>
      <h1 style={{ fontSize: 32, marginTop: 6, marginBottom: 6 }}>Your clients</h1>
      <p style={{ color: "var(--att-text-2)", maxWidth: 640, marginBottom: 24 }}>
        Every survivor who has shared their PatternProof case file with you. Read-only. Chain-of-custody logged.
      </p>

      {/* Diagnosis card — never shows a raw empty grid */}
      <DiagnosisCard clientCount={clients?.length ?? null} tier={sub.tier} />

      {!clients ? null : clients.length === 0 ? null : (
        <div className="att-card">Loading clients…</div>
      )}

      {clients && clients.length > 0 && (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <span className="att-tag" style={{ background: `${risk.color}1A`, color: risk.color }}>{risk.label}</span>
                  </div>
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
                  <span>{c.last_incident_date ? `Latest: ${new Date(c.last_incident_date).toLocaleDateString()}` : "No incidents yet"}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--att-navy)", fontWeight: 600 }}>Open case <ArrowRight size={12} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiagnosisCard({ clientCount, tier }: { clientCount: number | null; tier: string }) {
  const tierLabel = tier === "firm" ? "Firm" : tier === "enterprise" ? "Enterprise" : tier === "solo" ? "Solo" : "Solo";
  const cap = tier === "firm" || tier === "enterprise" ? "Unlimited" : "5";
  const status = clientCount === null ? "loading" : clientCount === 0 ? "empty" : "active";
  return (
    <div className="att-card" style={{ marginBottom: 24, borderLeft: "4px solid var(--att-navy)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="att-eyebrow">Portal status</div>
          <h2 style={{ fontSize: 22, margin: "4px 0 6px", fontFamily: '"Instrument Serif", serif' }}>
            {status === "loading" && "Opening your portal…"}
            {status === "empty" && "You're ready. The first invite is the next move."}
            {status === "active" && `${clientCount} client case file${clientCount === 1 ? "" : "s"} active.`}
          </h2>
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
            Plan: <strong>PatternProof {tierLabel}</strong> · Client cap: {cap}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
          <div className="att-eyebrow">What needs attention</div>
          {status === "empty" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Send size={14} style={{ color: "var(--att-blue)" }} />
              <span>Send your first client an invitation link.</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <CheckCircle2 size={14} style={{ color: "var(--att-green)" }} />
              <span>Open a case file below to begin review.</span>
            </div>
          )}
        </div>
      </div>
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