import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyJevSharePermissions, setMyJevSharePermission } from "@/lib/jev-consent.functions";

type State = Awaited<ReturnType<typeof getMyJevSharePermissions>>;
export function JevSharePermissions() {
  const get = useServerFn(getMyJevSharePermissions);
  const set = useServerFn(setMyJevSharePermission);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const load = useCallback(async () => {
    try {
      setState(await get());
      setAgreed({});
      setPasswords({});
      setError(null);
    } catch {
      setError(
        "We couldn't check these permissions. Your existing permissions may still be active.",
      );
    }
  }, [get]);
  useEffect(() => {
    void load();
  }, [load]);
  async function change(linkId: string, enabled: boolean) {
    if (enabled && !agreed[linkId]) return;
    setBusy(linkId);
    try {
      await set({
        data: {
          linkId,
          enabled,
          ...(enabled
            ? { scopeFingerprint: state?.shares.find((s) => s.linkId === linkId)?.scopeFingerprint }
            : {}),
          ...(enabled && passwords[linkId] ? { password: passwords[linkId] } : {}),
        },
      });
      setPasswords((p) => ({ ...p, [linkId]: "" }));
      setAgreed((p) => ({ ...p, [linkId]: false }));
      toast(
        enabled
          ? "Jev request checks allowed for this share for 30 days."
          : "Jev request checks turned off for this share.",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update that permission.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="card-pp mt-6" aria-label="Jev request matching permissions">
      <h2 className="font-serif text-[19px]">AI checks for already-shared files</h2>
      <p className="mt-2 text-[13px]">
        Off unless you allow it. TypeSafe's Jev service can compare an attorney's request with
        relevant excerpts from files you already shared with that attorney. It returns a possible
        match, not a finding or a missing-items checklist.
      </p>
      <p className="mt-2 text-[13px]">
        Only AI-eligible, unsealed files in this sharing record can be used. This does not share new
        files or change your records. Permission lasts 30 days and pauses if the shared file scope
        changes. Turning it off prevents new checks; material already sent cannot be recalled.
      </p>
      <p className="mt-2 text-[13px]">
        <a
          className="underline"
          href="https://docs.typesafe.ai/legal"
          target="_blank"
          rel="noreferrer"
        >
          TypeSafe provider policies
        </a>{" "}
        · You and your attorney can review files manually at any time.
      </p>
      {error && (
        <div role="alert" className="mt-3 text-sm">
          <p>{error}</p>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            Retry permission check
          </button>
        </div>
      )}
      {!state && !error && <p className="mt-3 text-sm">Checking permissions…</p>}
      {state && !error && (
        <>
          {!state.available && (
            <p className="mt-3 text-sm">
              Jev processing is not currently enabled for this app. You can still turn off an
              existing permission.
            </p>
          )}
          {!state.shares.length && (
            <p className="mt-3 text-sm">No active attorney sharing records.</p>
          )}
          {state.shares.map((share) => (
            <div key={share.linkId} className="mt-4 border-t pt-3 text-sm">
              <p className="font-semibold">
                {share.attorneyName} · {share.fileCount} shared files
              </p>
              <p>
                Jev request checks:{" "}
                {share.enabled
                  ? `Allowed until ${new Date(share.expiresAt!).toLocaleDateString()}`
                  : "Off"}
              </p>
              {share.enabled ? (
                <button
                  type="button"
                  className="btn-ghost mt-2"
                  disabled={busy !== null}
                  onClick={() => void change(share.linkId, false)}
                >
                  Turn off for {share.attorneyName}
                </button>
              ) : (
                <>
                  <label className="mt-3 flex items-start gap-2">
                    <input
                      type="checkbox"
                      disabled={!state.available || busy !== null}
                      checked={!!agreed[share.linkId]}
                      onChange={(e) =>
                        setAgreed((p) => ({ ...p, [share.linkId]: e.target.checked }))
                      }
                    />
                    <span>
                      I allow {share.attorneyName} to send relevant excerpts from this current share
                      to TypeSafe for request matching.
                    </span>
                  </label>
                  {state.requiresPassword && (
                    <label className="mt-2 block">
                      Confirm your account password
                      <input
                        type="password"
                        autoComplete="current-password"
                        className="input-pp mt-1"
                        value={passwords[share.linkId] ?? ""}
                        onChange={(e) =>
                          setPasswords((p) => ({ ...p, [share.linkId]: e.target.value }))
                        }
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="btn-primary mt-2"
                    disabled={
                      !state.available ||
                      !agreed[share.linkId] ||
                      busy !== null ||
                      (state.requiresPassword && !passwords[share.linkId])
                    }
                    onClick={() => void change(share.linkId, true)}
                  >
                    {busy === share.linkId ? "Saving…" : "Allow checks for 30 days"}
                  </button>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
