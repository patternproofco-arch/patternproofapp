import { ForgotPinPanel } from "@/components/ForgotPinPanel";

/**
 * Shown when the account's screen lock is on but nothing can open it any more: most often the older
 * Face ID / fingerprint setup, which we replaced with a version the server can check, or site data
 * that was cleared. Setting a new PIN here takes the account password, checked on the server, so
 * this screen is not a way past the lock. Face ID / fingerprint can be added again in Settings.
 */
export function LockRecoveryScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="card-pp w-full max-w-[420px]">
        <div className="label-eyebrow">Screen lock</div>
        <ForgotPinPanel
          title="Set your screen lock again"
          intro="Your screen lock needs to be set up again. We made Face ID and fingerprint unlock more secure, so it has to be turned on once more. Your entries are not affected. Confirm it's you, then choose a PIN. You can add Face ID or fingerprint again in Settings."
        />
        <p className="mt-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          This screen lock helps deter casual access to your account. It is not a guarantee against
          someone with deeper technical access to this device.
        </p>
      </div>
    </div>
  );
}
