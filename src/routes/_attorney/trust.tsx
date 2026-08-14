import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Activity, Lock, Mail, Shield, ShieldCheck, Users } from "lucide-react";
import { getTrustPanel } from "@/lib/attorney-trust.functions";

export const Route = createFileRoute("/_attorney/trust")({
  component: SettingsPage,
});

type Panel = Awaited<ReturnType<typeof getTrustPanel>>;

function SettingsPage() {
  const fetcher = useServerFn(getTrustPanel);
  const [data, setData] = useState<Panel | null>(null);

  useEffect(() => {
    fetcher({ data: {} }).then(setData).catch(() => setData({ links: [], invites: [], audit: [] }));
  }, [fetcher]);

  if (!data) return <div className="att-card">Loading trust panel…</div>;

  const activeLinks = data.links.filter((l) => l.status === "active");
  const revokedLinks = data.links.filter((l) => l.status !== "active");
  const pendingInvites = data.invites.filter((i) => i.status === "pending");

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1080, margin: "0 auto" }}>
      <div>
        <div className="att-eyebrow">Settings · Trust</div>
        <h1 className="att-page-title">Security &amp; provenance & integrity</h1>
      </div>

      <div className="att-card" style={{ background: "var(--att-surface-2)", borderColor: "var(--att-border-strong)", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <ShieldCheck size={20} style={{ color: "var(--att-navy)", marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Read-only access · Survivor-owned data</div>
          <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 4, lineHeight: 1.6 }}>
            You can review and export. You cannot edit, delete, or modify a survivor's incidents, evidence, or
            communications. Case opens, evidence downloads, and packet exports are recorded for provenance & integrity. Private attorney notes
            never sync back to the survivor.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
        <Stat icon={<Users size={14} />} label="Active client links" value={activeLinks.length} />
        <Stat icon={<Mail size={14} />} label="Pending survivor invites" value={pendingInvites.length} />
        <Stat icon={<Shield size={14} />} label="Revoked links" value={revokedLinks.length} />
      </div>

      <div className="att-card">
        <SectionTitle icon={<Activity size={16} />}>Recent access log</SectionTitle>
        {data.audit.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No audit entries yet. Activity will appear here as you view and export case files.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {data.audit.map((a) => (
              <li key={a.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 12, fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--att-border)" }}>
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>{new Date(a.timestamp_utc).toLocaleString()}</span>
                <span>{a.action_type}</span>
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>{a.record_reference ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="att-card">
        <SectionTitle icon={<Mail size={16} />}>Invite history</SectionTitle>
        {data.invites.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>You haven't invited any survivors yet. <Link to="/clients" style={{ color: "var(--att-blue)" }}>Open the client list</Link> to send your first invite.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {data.invites.map((i) => (
              <li key={i.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 160px", gap: 10, fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--att-border)" }}>
                <span>{i.survivor_email}</span>
                <span className="att-tag" style={{ background: i.status === "accepted" ? "rgba(21,32,56,0.07)" : i.status === "pending" ? "#FFFFFF" : "#FFFFFF", color: "var(--att-text)" }}>{i.status}</span>
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>{new Date(i.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="att-card">
        <SectionTitle icon={<Shield size={16} />}>Revoked links</SectionTitle>
        {revokedLinks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>None — all your client links are active.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {revokedLinks.map((l) => (
              <li key={l.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--att-border)" }}>
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>client {String(l.client_user_id).slice(0, 8)}</span>
                {" · "}revoked {l.revoked_at ? new Date(l.revoked_at).toLocaleDateString() : "—"}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="att-card" style={{ background: "#FFFFFF", borderColor: "var(--att-border-strong)", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Lock size={18} style={{ color: "var(--att-text-2)", marginTop: 2 }} />
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <strong>Confidentiality reminder.</strong> The records in this portal are protected by attorney-client
          privilege and your jurisdiction's evidence rules. Do not share signed URLs, exported ZIPs, or screenshots
          outside privileged channels. All access is logged.
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="att-card">
      <div className="att-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 28, fontFamily: "\"Space Grotesk\", system-ui, sans-serif", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      {icon}
      <h2 style={{ fontSize: 18 }}>{children}</h2>
    </div>
  );
}
