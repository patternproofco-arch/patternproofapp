import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Monitor, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
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
  const [wasOnboarded, setWasOnboarded] = useState(false);
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
        // Already-onboarded advocates land here from the Settings link with
        // an acknowledgement already on file — re-confirming it every visit
        // just to change an org name would be friction with no purpose.
        if (r.profile?.onboarded) {
          setWasOnboarded(true);
          setConfidentiality(true);
        }
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
      if (wasOnboarded) {
        toast("Saved.");
      } else {
        toast("Saved. Your cases are ready.");
        navigate({ to: "/advocate-cases", replace: true });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "We couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const signOutOtherDevices = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      toast(
        error
          ? "Couldn't sign out other devices. Try again in a moment."
          : "Signed out everywhere except this device.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="card-pp">Loading…</div>;

  return (
    <div style={{ maxWidth: 640, margin: "24px auto", display: "grid", gap: 18 }}>
      <div>
        <h1 className="font-serif text-[26px]" style={{ marginBottom: 6 }}>
          {wasOnboarded ? "Settings" : "Set up your advocate profile"}
        </h1>
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Survivors see only your name and organization.
        </p>
      </div>

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

        {!wasOnboarded && (
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
              <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />I
              acknowledge that survivor records are confidential. I will open only the records I
              have been given access to, and treat everything I see as private.
            </span>
          </label>
        )}

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : wasOnboarded ? "Save changes" : "Open my cases"}
        </button>
      </form>

      {wasOnboarded && (
        <div className="card-pp">
          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <Monitor size={16} />
            <span className="font-serif text-[16px]">Security</span>
          </div>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)", marginBottom: 10 }}>
            If you ever signed in on a computer or phone you don't control anymore, end that
            session from here — you don't need access to that device to do it.
          </p>
          <button onClick={signOutOtherDevices} disabled={busy} className="btn-ghost" type="button">
            Sign out of every other device
          </button>
        </div>
      )}
    </div>
  );
}
