import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Lock, Mail, Monitor, Shield, ShieldCheck, User, Users } from "lucide-react";
import { getTrustPanel } from "@/lib/attorney-trust.functions";
import { getAttorneyProfile, upsertAttorneyProfile } from "@/lib/attorney-portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { TwoFactorCard } from "@/components/TwoFactorCard";

export const Route = createFileRoute("/_attorney/trust")({
  component: SettingsPage,
});

type Panel = Awaited<ReturnType<typeof getTrustPanel>>;

const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "trust-activity", label: "Trust & activity" },
  { id: "security", label: "Security" },
];

function SettingsNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="no-print"
      style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}
    >
      {SETTINGS_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 999,
            background: "var(--att-surface-2)",
            color: "var(--att-text)",
            textDecoration: "none",
          }}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

function ProfileSection() {
  const getProfile = useServerFn(getAttorneyProfile);
  const save = useServerFn(upsertAttorneyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  useEffect(() => {
    getProfile()
      .then((r) => {
        const p = r.profile;
        if (!p) return;
        setFullName(p.full_name ?? "");
        setEmail(p.email ?? "");
        setFirmName(p.firm_name ?? "");
        setBarNumber(p.bar_number ?? "");
        setJurisdiction(p.jurisdiction ?? "");
      })
      .finally(() => setLoading(false));
  }, [getProfile]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        data: {
          full_name: fullName.trim(),
          email: email.trim(),
          firm_name: firmName.trim() || null,
          bar_number: barNumber.trim() || null,
          jurisdiction: jurisdiction.trim() || null,
        },
      });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="profile" className="att-card" style={{ scrollMarginTop: 24 }}>
      <SectionTitle icon={<User size={16} />}>Profile</SectionTitle>
      <p style={{ fontSize: 13, color: "var(--att-text-2)", marginBottom: 14 }}>
        This was only editable once, during setup. Survivors only ever see your name and firm.
      </p>
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>Loading…</p>
      ) : (
        <form onSubmit={onSave} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <ProfileField label="Full name">
              <input
                className="att-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
                required
              />
            </ProfileField>
            <ProfileField label="Email">
              <input
                className="att-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
              />
            </ProfileField>
            <ProfileField label="Firm / organization">
              <input
                className="att-input"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                maxLength={200}
                placeholder="Optional"
              />
            </ProfileField>
            <ProfileField label="Bar number">
              <input
                className="att-input"
                value={barNumber}
                onChange={(e) => setBarNumber(e.target.value)}
                maxLength={60}
                placeholder="Optional"
              />
            </ProfileField>
            <ProfileField label="Jurisdiction">
              <input
                className="att-input"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                maxLength={120}
                placeholder="e.g. NJ, NY, Family Court"
              />
            </ProfileField>
          </div>
          <div>
            <button type="submit" disabled={saving} className="att-btn-primary">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.08,
          textTransform: "uppercase",
          color: "var(--att-slate)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function SecuritySection() {
  const [signingOut, setSigningOut] = useState(false);

  const signOutOtherDevices = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      toast[error ? "error" : "success"](
        error
          ? "Couldn't sign out other devices. Try again in a moment."
          : "Signed out everywhere except this device.",
      );
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="att-card">
      <SectionTitle icon={<Monitor size={16} />}>Signed-in devices</SectionTitle>
      <p style={{ fontSize: 13, color: "var(--att-text-2)", marginBottom: 12 }}>
        If you ever signed in on a computer or phone you don't control anymore, end that session
        from here — you don't need access to that device to do it. This signs out every session
        except the one you're using right now.
      </p>
      <button
        onClick={signOutOtherDevices}
        disabled={signingOut}
        className="att-btn-secondary"
        type="button"
      >
        {signingOut ? "Signing out other devices…" : "Sign out of every other device"}
      </button>
    </div>
  );
}

function SettingsPage() {
  const fetcher = useServerFn(getTrustPanel);
  const [data, setData] = useState<Panel | null>(null);

  useEffect(() => {
    fetcher({ data: {} })
      .then(setData)
      .catch(() => setData({ links: [], invites: [], audit: [] }));
  }, [fetcher]);

  if (!data) return <div className="att-card">Loading…</div>;

  const activeLinks = data.links.filter((l) => l.status === "active");
  const revokedLinks = data.links.filter((l) => l.status !== "active");
  const pendingInvites = data.invites.filter((i) => i.status === "pending");

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1080, margin: "0 auto" }}>
      <div>
        <div className="att-eyebrow">Attorney Portal</div>
        <h1 className="att-page-title">Settings</h1>
      </div>

      <SettingsNav />

      <ProfileSection />

      <div id="trust-activity" style={{ scrollMarginTop: 24 }}>
        <div className="att-eyebrow" style={{ marginBottom: 8 }}>
          Trust &amp; activity
        </div>
      </div>

      <div
        className="att-card"
        style={{
          background: "var(--att-surface-2)",
          borderColor: "var(--att-border-strong)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <ShieldCheck size={20} style={{ color: "var(--att-navy)", marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            Read-only access · Survivor-owned data
          </div>
          <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 4, lineHeight: 1.6 }}>
            You can review and export. You cannot edit, delete, or modify a survivor's incidents,
            evidence, or communications. Case opens, evidence downloads, and packet exports are
            recorded for provenance & integrity. Private attorney notes never sync back to the
            survivor.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
        <Stat icon={<Users size={14} />} label="Active client links" value={activeLinks.length} />
        <Stat
          icon={<Mail size={14} />}
          label="Pending survivor invites"
          value={pendingInvites.length}
        />
        <Stat icon={<Shield size={14} />} label="Revoked links" value={revokedLinks.length} />
      </div>

      <div className="att-card">
        <SectionTitle icon={<Activity size={16} />}>Recent access log</SectionTitle>
        {data.audit.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
            No audit entries yet. Activity will appear here as you view and export case files.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {data.audit.map((a) => (
              <li
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 1fr",
                  gap: 12,
                  fontSize: 12,
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--att-border)",
                }}
              >
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>
                  {new Date(a.timestamp_utc).toLocaleString()}
                </span>
                <span>{a.action_type}</span>
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>
                  {a.record_reference ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="att-card">
        <SectionTitle icon={<Mail size={16} />}>Invite history</SectionTitle>
        {data.invites.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
            You haven't invited any survivors yet.{" "}
            <Link to="/clients" style={{ color: "var(--att-blue)" }}>
              Open the client list
            </Link>{" "}
            to send your first invite.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {data.invites.map((i) => (
              <li
                key={i.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 110px 160px",
                  gap: 10,
                  fontSize: 13,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--att-border)",
                }}
              >
                <span>{i.survivor_email}</span>
                <span
                  className="att-tag"
                  style={{
                    background:
                      i.status === "accepted"
                        ? "rgba(21,32,56,0.07)"
                        : i.status === "pending"
                          ? "#FFFFFF"
                          : "#FFFFFF",
                    color: "var(--att-text)",
                  }}
                >
                  {i.status}
                </span>
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>
                  {new Date(i.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="att-card">
        <SectionTitle icon={<Shield size={16} />}>Revoked links</SectionTitle>
        {revokedLinks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
            None — all your client links are active.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {revokedLinks.map((l) => (
              <li
                key={l.id}
                style={{
                  fontSize: 13,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--att-border)",
                }}
              >
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>
                  client {String(l.client_user_id).slice(0, 8)}
                </span>
                {" · "}revoked {l.revoked_at ? new Date(l.revoked_at).toLocaleDateString() : "—"}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="att-card"
        style={{
          background: "var(--pp-card)",
          borderColor: "var(--att-border-strong)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <Lock size={18} style={{ color: "var(--att-text-2)", marginTop: 2 }} />
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <strong>Confidentiality reminder.</strong> The records in this portal are protected by
          attorney-client privilege and your jurisdiction's evidence rules. Do not share signed
          URLs, exported ZIPs, or screenshots outside privileged channels. All access is logged.
        </div>
      </div>

      <div id="security" style={{ display: "grid", gap: 20, scrollMarginTop: 24 }}>
        <div className="att-eyebrow">Security</div>
        <ChangePasswordCard className="att-card" headingClassName="att-page-title" />
        <TwoFactorCard className="att-card" headingClassName="att-page-title" required />
        <SecuritySection />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="att-card">
      <div className="att-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 28, fontFamily: "var(--font-sans)", marginTop: 4 }}>{value}</div>
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
