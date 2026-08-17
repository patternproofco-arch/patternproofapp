import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/request-org-access")({
  head: () => ({
    meta: [
      { title: "PatternProof — Request DV organization access" },
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error: insertError } = await supabase.from("org_access_requests").insert({
      org_name: form.org,
      contact_name: form.name,
      email: form.email,
      contact_role: form.role || null,
      survivors_per_month: form.survivors || null,
      message: form.note || null,
      status: "pending",
    });
    setSending(false);
    if (insertError) {
      setError("We couldn't send that request. Try again in a moment.");
      return;
    }
    setSubmitted(true);
  };

  return (
    <div data-persona="org" style={{ minHeight: "100vh", background: "#FAF8F4", padding: "60px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none", marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back to PatternProof
        </Link>
        <div style={{ background: "#FFFFFF", borderRadius: 2, padding: 36, border: "1px solid var(--border)" }}>
          <BrandLogo size={44} />
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
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 20, background: "rgba(127,161,137,0.20)", borderRadius: 2 }}>
                <Check size={20} style={{ color: "var(--teal-dark)", marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Request received.</div>
                  <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
                    We'll review it and reply within a few days. Survivor accounts are free — there
                    is no survivor subscription, trial, or paid feature, whether or not someone signs
                    up through your link. Once your account is set up, you'll have your own partner
                    dashboard at /org-portal showing referral counts anytime.
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                Partner organizations see aggregate referral counts only — never survivor names,
                records, or anything a survivor has documented. Partners do not administer, review,
                or manage survivor accounts. A survivor's documentation reaches an advocate only if
                that survivor separately and explicitly shares it through the advocate workflow.
              </p>
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
                  style={{ width: "100%", padding: 12, borderRadius: 2, border: "1px solid var(--border)", fontSize: 14, fontFamily: "inherit" }}
                />
              </div>
              {error && (
                <div style={{ fontSize: 13, color: "var(--foreground)", background: "rgba(231,123,86,0.16)", padding: "10px 12px", borderRadius: 2 }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={sending}
                style={{ marginTop: 8, padding: "14px 24px", borderRadius: 2, background: "#5E3785", color: "#1A1224", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
              >
                {sending ? "Sending…" : "Request org access"}
              </button>
            </form>
          )}
        </div>
        <div style={{ marginTop: 20, background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 2, padding: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700 }}>
            Partner transparency
          </div>
          <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: "var(--foreground)" }}>
            <li>
              PatternProof is currently founder-operated by Grace Burns. Support comes directly from her, by email,
              rather than from a ticketing desk — so please plan for a human response time, not an instant one.
            </li>
            <li>
              As a matter of our business model, partnership costs your organization nothing and survivor features
              are not paywalled. There is no charge in the product for survivor accounts.
            </li>
            <li>
              What an advocate can see, once a survivor invites them: the entries that survivor shared, including the
              date, time, location and description she wrote and the tags on them; a list of her evidence showing
              title, date, description and file type; and, if she allows it, the recurrence grouping and the case
              summary she wrote.
            </li>
            <li>
              What an advocate can never see: evidence files themselves (no opening, downloading or playback), GPS
              coordinates, photo metadata, filenames, transcripts, witness or impact notes, and anything the survivor
              did not share. Advocates cannot edit or delete anything.
            </li>
            <li>Survivors grant and withdraw advocate access themselves; your organization can't request it on their behalf.</li>
            <li>Data is encrypted in transit and at rest by our infrastructure host. This is not zero-knowledge encryption.</li>
            <li>
              Funding: law-firm subscriptions, plus optional pay-what-you-can contributions that unlock no additional
              features. It is our policy not to sell survivor data or leads, take referral fees or paid placement, or
              accept advertiser or data-broker funding.
            </li>
          </ul>
        </div>
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
          Already partnering with us?{" "}
          <Link to="/org-feedback" style={{ color: "#5E1730", fontWeight: 600, textDecoration: "underline" }}>
            Share feedback about PatternProof
          </Link>{" "}
          ·{" "}
          <Link to="/org-portal" style={{ color: "#5E1730", fontWeight: 600, textDecoration: "underline" }}>
            Go to your partner dashboard
          </Link>
        </div>
      </div>
    </div>
  );
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
        style={{ width: "100%", padding: 12, borderRadius: 2, border: "1px solid var(--border)", fontSize: 14, fontFamily: "inherit" }}
      />
    </div>
  );
}