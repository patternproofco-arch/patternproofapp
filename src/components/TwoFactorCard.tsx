import { useEffect, useState } from "react";
import { Shield, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dropUnverifiedTotpFactors } from "@/lib/mfa";
import { SURVIVOR_TWO_STEP_COPY as S } from "@/lib/two-step-copy";

type Factor = { id: string; status: string; friendly_name?: string; created_at?: string };

export function TwoFactorCard({
  className = "card-pp mt-6",
  headingClassName = "font-serif text-[19px]",
  required = false,
  variant = "default",
}: {
  className?: string;
  headingClassName?: string;
  required?: boolean;
  /** "survivor": optional two-step with calm copy, backup app, per-app removal. */
  variant?: "default" | "survivor";
}) {
  const survivor = variant === "survivor" && !required;
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
    setFactors(
      (data.totp ?? []).map((f) => ({
        id: f.id,
        status: f.status,
        friendly_name: f.friendly_name,
        created_at: f.created_at,
      })),
    );
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
        // Friendly names must be unique per account; backups get a dated name.
        friendlyName:
          verified.length === 0
            ? "Authenticator"
            : `Authenticator ${verified.length + 1} (${new Date().toISOString().slice(0, 10)})`,
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
      toast(survivor ? S.turnedOn : "Two-factor authentication is on.");
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

  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (required) return;
    const factor = verified.find((f) => f.id === removeTarget) ?? verified[0];
    if (!factor) return;
    const trimmed = disableCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the current 6-digit code to turn this off.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Removing an app needs a fresh code check (aal2) first. Survivors may have
      // lost the app being removed, so a code from any of their apps is accepted.
      const candidates = survivor
        ? [factor, ...verified.filter((f) => f.id !== factor.id)]
        : [factor];
      let verifyError: unknown = new Error("That code didn't match. Try the next one.");
      for (const candidate of candidates) {
        const res = await supabase.auth.mfa.challengeAndVerify({
          factorId: candidate.id,
          code: trimmed,
        });
        verifyError = res.error;
        if (!res.error) break;
      }
      if (verifyError) throw verifyError;
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) throw unenrollError;
      setDisableCode("");
      setRemoveTarget(null);
      toast(
        survivor
          ? verified.length > 1
            ? S.removedOne
            : S.turnedOff
          : "Two-factor authentication is off.",
      );
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
        <h2 className={headingClassName}>{survivor ? S.heading : "Two-factor authentication"}</h2>
      </div>
      {survivor ? (
        <div className="mt-2 space-y-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          <p>{S.intro}</p>
          <p>{S.noSms}</p>
        </div>
      ) : (
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          {required
            ? "An authenticator app is required before this account can open shared case files, downloads, or exports. PatternProof does not send codes by text."
            : "After your password, PatternProof asks for a 6-digit code from an authenticator app (Authy, Google Authenticator, 1Password, iCloud Keychain). We don't use text messages — a shared or stolen phone number shouldn't be able to open this account."}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Checking…
        </p>
      ) : enrolling ? (
        <div className="mt-4 space-y-3" data-testid="two-step-enroll">
          {survivor ? <p className="text-[13px]">{S.scanStep}</p> : null}
          {qr ? (
            <img
              src={qr}
              alt="QR code to add PatternProof to your authenticator app"
              className="mx-auto rounded-xl bg-white p-3"
              style={{ width: 180, height: 180 }}
            />
          ) : null}
          {secret && survivor ? (
            <div
              className="rounded-2xl px-3 py-2.5 text-[12px]"
              style={{ background: "var(--input)", color: "var(--muted-foreground)" }}
            >
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                {S.keyLabel}
              </p>
              <code
                data-testid="two-step-secret"
                className="mt-1 block text-[13px] tracking-wide break-all"
                style={{ color: "var(--foreground)" }}
              >
                {secret}
              </code>
              <p className="mt-2">{S.keyPrivate}</p>
            </div>
          ) : null}
          {survivor ? <p className="text-[13px]">{S.codeStep}</p> : null}
          {secret && !survivor ? (
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
              aria-label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error ? (
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "One moment…" : survivor ? S.confirmButton : "Confirm and turn on"}
            </button>
            <button type="button" onClick={() => void cancelEnroll()} className="btn-ghost w-full">
              Cancel
            </button>
          </form>
        </div>
      ) : verified.length > 0 && survivor ? (
        <div className="mt-4 space-y-3" data-testid="two-step-on">
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[13px]"
            style={{ background: "var(--input)" }}
          >
            <Shield size={14} style={{ color: "var(--safe)" }} />
            {S.onStatus}
          </div>
          <ul className="space-y-2" aria-label="Your authenticator apps">
            {verified.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-[13px]"
                style={{ border: "1px solid var(--border)" }}
              >
                <span>
                  {f.friendly_name || "Authenticator"}
                  {f.created_at ? (
                    <span style={{ color: "var(--muted-foreground)" }}>
                      {" "}
                      · added {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="text-[12px]"
                  style={{ color: "var(--accent)" }}
                  onClick={() => {
                    setRemoveTarget(f.id);
                    setDisableCode("");
                    setError(null);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {removeTarget ? (
            <form onSubmit={disable} className="space-y-3" data-testid="two-step-remove">
              <input
                aria-label={S.removeLabel}
                className="input-pp text-center tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {S.removeLabel}.
              </p>
              {error ? (
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="btn-ghost">
                  {busy ? "One moment…" : S.removeButton}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setRemoveTarget(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startEnroll()}
              className="btn-ghost"
            >
              {S.addSecond}
            </button>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {S.addSecondHint}
            </p>
          </div>
        </div>
      ) : verified.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[13px]"
            style={{ background: "var(--input)" }}
          >
            <Shield size={14} style={{ color: "var(--safe)" }} />
            {required ? "On — required to open case files." : "On — a code is required at sign-in."}
          </div>
          {!required ? (
            <form onSubmit={disable} className="space-y-3">
              <input
                aria-label="Code to turn off"
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
          <button
            type="button"
            disabled={busy}
            onClick={() => void startEnroll()}
            className="btn-primary"
          >
            {busy ? "One moment…" : survivor ? S.startButton : "Set up authenticator"}
          </button>
        </div>
      )}
      {survivor ? (
        <div className="mt-5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          <p className="font-semibold" style={{ color: "var(--foreground)" }}>
            {S.lostHeading}
          </p>
          <p className="mt-1">{S.lostBody}</p>
          <p className="mt-1">{S.resetNote}</p>
        </div>
      ) : null}
    </div>
  );
}
