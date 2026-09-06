import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { completeAdvocateOnboarding, getMyAdvocateRole } from "@/lib/advocate.functions";

export const Route = createFileRoute("/_advocate/advocate-setup")({
  component: AdvocateSetupPage,
});

function AdvocateSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const readRole = useServerFn(getMyAdvocateRole);
  const save = useServerFn(completeAdvocateOnboarding);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [confidentiality, setConfidentiality] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readRole()
      .then((r) => {
        if (cancelled) return;
        setFullName(r.profile?.full_name ?? "");
        setOrgName(r.profile?.org_name ?? "");
        setEmail(r.profile?.email ?? user?.email ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readRole, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confidentiality) {
      toast("Please confirm the confidentiality acknowledgement.");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          full_name: fullName.trim(),
          org_name: orgName.trim() || null,
          email: email.trim(),
          confidentiality_accepted: true,
        },
      });
      toast("Saved. Your cases are ready.");
      navigate({ to: "/advocate-cases", replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "We couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="card-pp">Loading…</div>;

  return (
    <div style={{ maxWidth: 640, margin: "24px auto" }}>
      <h1 className="font-serif text-[26px]" style={{ marginBottom: 6 }}>
        Set up your advocate profile
      </h1>
      <p className="text-[13px]" style={{ color: "var(--muted-foreground)", marginBottom: 18 }}>
        Survivors see only your name and organization. This takes a moment.
      </p>

      <form onSubmit={onSubmit} className="card-pp space-y-3">
        <input
          className="input-pp"
          required
          maxLength={120}
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="input-pp"
          maxLength={200}
          placeholder="Organization (optional)"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />
        <input
          className="input-pp"
          type="email"
          required
          maxLength={255}
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontSize: 13,
            lineHeight: 1.55,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={confidentiality}
            onChange={(e) => setConfidentiality(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />I acknowledge
            that survivor records are confidential. I will open only the records I have been given
            access to, and treat everything I see as private.
          </span>
        </label>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Open my cases"}
        </button>
      </form>
    </div>
  );
}
