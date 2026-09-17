import { useEffect, useState } from "react";
import { Shield, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dropUnverifiedTotpFactors } from "@/lib/mfa";

type Factor = { id: string; status: string; friendly_name?: string };

export function TwoFactorCard({
  className = "card-pp mt-6",
  headingClassName = "font-serif text-[19px]",
  required = false,
}: {
  className?: string;
  headingClassName?: string;
  required?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disableCode, setDisableCode] = useState("");

  const verified = factors.filter((f) => f.status === "verified");

  const refresh = async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setFactors([]);
      return;
    }
    setFactors((data.totp ?? []).map((f) => ({ id: f.id, status: f.status, friendly_name: f.friendly_name })));
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const startEnroll = async () => {
    setError(null);
    setBusy(true);
    try {
      await dropUnverifiedTotpFactors();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator",
      });
      if (enrollError || !data) throw enrollError ?? new Error("Could not start setup.");
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrolling(true);
      setCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We couldn't start two-factor setup.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    const trimmed = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: trimmed,
      });
      if (verifyError) throw verifyError;
      setEnrolling(false);
      setQr(null);
      setSecret(null);
      setFactorId(null);
      setCode("");
      toast("Two-factor authentication is on.");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That code didn't match. Try the next one.");
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
    setEnrolling(false);
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    setError(null);
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (required) return;
    const factor = verified[0];
    if (!factor) return;
    const trimmed = disableCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the current 6-digit code to turn this off.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: trimmed,
      });
      if (verifyError) throw verifyError;
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) throw unenrollError;
      setDisableCode("");
      toast("Two-factor authentication is off.");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We couldn't turn that off. Check the code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Smartphone size={18} style={{ color: "var(--primary)" }} />
        <h2 className={headingClassName}>Two-factor authentication</h2>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        {required
          ? "An authenticator app is required before this account can open shared case files, downloads, or exports. PatternProof does not send codes by text."
          : "After your password, PatternProof asks for a 6-digit code from an authenticator app (Authy, Google Authenticator, 1Password, iCloud Keychain). We don't use text messages — a shared or stolen phone number shouldn't be able to open this account."}
      </p>

      {loading ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Checking…
        </p>
      ) : enrolling ? (
        <div className="mt-4 space-y-3">
          {qr ? (
            <img
              src={qr}
              alt="QR code to add PatternProof to your authenticator app"
              className="mx-auto rounded-xl bg-white p-3"
              style={{ width: 180, height: 180 }}
            />
          ) : null}
          {secret ? (
            <p className="text-center text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Can't scan? Enter this key instead:
              <br />
              <code className="mt-1 inline-block text-[13px] tracking-wide">{secret}</code>
            </p>
          ) : null}
          <form onSubmit={confirmEnroll} className="space-y-3">
            <input
              className="input-pp text-center tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error ? (
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "One moment…" : "Confirm and turn on"}
            </button>
            <button type="button" onClick={() => void cancelEnroll()} className="btn-ghost w-full">
              Cancel
            </button>
          </form>
        </div>
      ) : verified.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[13px]"
            style={{ background: "var(--input)" }}
          >
            <Shield size={14} style={{ color: "var(--safe)" }} />
            {required
              ? "On — required to open case files."
              : "On — a code is required at sign-in."}
          </div>
          {!required ? (
            <form onSubmit={disable} className="space-y-3">
              <input
                className="input-pp text-center tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Code to turn off"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {error ? (
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={busy} className="btn-ghost">
                {busy ? "One moment…" : "Turn off two-factor"}
              </button>
            </form>
          ) : (
            <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Contact PatternProof support if this device is lost. Turning this off from here would
              leave shared files on a password-only login.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {error ? (
            <p className="mb-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {error}
            </p>
          ) : null}
          <button type="button" disabled={busy} onClick={() => void startEnroll()} className="btn-primary">
            {busy ? "One moment…" : "Set up authenticator"}
          </button>
        </div>
      )}
    </div>
  );
}
