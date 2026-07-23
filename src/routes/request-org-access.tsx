import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/request-org-access")({
  head: () => ({
    meta: [
      { title: "Request DV organization access — PatternProof" },
      { name: "description", content: "Request invite-only access to PatternProof for your domestic violence organization." },
      { property: "og:title", content: "Request DV organization access — PatternProof" },
      { property: "og:description", content: "Invite-only access for DV organizations and advocates." },
      { property: "og:url", content: "https://pattern-proof.tech/request-org-access" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/request-org-access" }],
  }),
  component: RequestOrgAccess,
});

function RequestOrgAccess() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ org: "", name: "", email: "", role: "", survivors: "", note: "" });
  const [copied, setCopied] = useState(false);

  const referralSlug = useMemo(() => slugify(form.org), [form.org]);
  const referralUrl = referralSlug
    ? `https://pattern-proof.tech/login?ref=${referralSlug}`
    : "";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Stub: open user's mail client with prefilled request, including the
    // referral slug we'll wire up for their survivors.
    const body = encodeURIComponent(
      `Organization: ${form.org}\nContact: ${form.name}\nEmail: ${form.email}\nRole: ${form.role}\nSurvivors served / mo: ${form.survivors}\nProposed referral link: ${referralUrl}\n\n${form.note}`
    );
    window.location.href = `mailto:hello@pattern-proof.tech?subject=${encodeURIComponent("DV org access request")}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F2F4F8, #E8EEF5)", padding: "60px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none", marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back to PatternProof
        </Link>
        <div style={{ background: "#FFFFFF", borderRadius: 24, padding: 36, border: "1px solid var(--border)" }}>
          <Logo variant="org" size={56} />
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, marginTop: 20 }}>
            DV organizations · invite-only
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "10px 0 12px" }}>
            Request access for your organization.
          </h1>
          <p style={{ color: "var(--muted-foreground)", marginBottom: 28 }}>
            We onboard DV organizations one at a time so we can support advocates well.
            Tell us about your team and we will be in touch.
          </p>

          {submitted ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 20, background: "rgba(189,230,212,0.30)", borderRadius: 14 }}>
                <Check size={20} style={{ color: "var(--teal-dark)", marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Request opened in your email.</div>
                  <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
                    Send the message and we will reply within a few days.
                  </div>
                </div>
              </div>
              {referralUrl && (
                <div style={{ padding: 20, borderRadius: 14, border: "1px solid var(--border)", background: "#FFFFFF" }}>
                  <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, marginBottom: 8 }}>
                    Your proposed referral link
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 10 }}>
                    Once we approve your organization, survivors who sign up through this link stay free forever and we can attribute their outcomes back to your advocacy.
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <code style={{ flex: 1, padding: "10px 12px", background: "#F5F5F0", borderRadius: 10, fontSize: 13, overflowWrap: "anywhere" }}>
                      {referralUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(referralUrl).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        });
                      }}
                      style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "#FFFFFF", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Copy size={14} /> {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
              <Input label="Organization name" value={form.org} onChange={(v) => setForm({ ...form, org: v })} required />
              <Input label="Your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
              <Input label="Your role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} placeholder="e.g. Advocate, Director" />
              <Input label="Survivors served per month (approx.)" value={form.survivors} onChange={(v) => setForm({ ...form, survivors: v })} />
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Anything else?</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={4}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontSize: 14, fontFamily: "inherit" }}
                />
              </div>
              <button
                type="submit"
                style={{ marginTop: 8, padding: "14px 24px", borderRadius: 999, background: "#3D72B8", color: "#FFFFFF", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
              >
                Request org access
              </button>
            </form>
          )}
        </div>
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
          Already partnering with us?{" "}
          <Link to="/org-feedback" style={{ color: "#3D72B8", fontWeight: 600, textDecoration: "underline" }}>
            Share feedback about PatternProof
          </Link>
        </div>
      </div>
    </div>
  );
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function Input({
  label, value, onChange, type = "text", required, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontSize: 14, fontFamily: "inherit" }}
      />
    </div>
  );
}