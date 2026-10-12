import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  allowCpsInvitesFn,
  blockCpsInvitesFn,
  getCpsInviteSettings,
  listMyCpsGrants,
  revokeCpsGrantFn,
} from "@/lib/cps.functions";

type Grant = Awaited<ReturnType<typeof listMyCpsGrants>>[number];

/**
 * Her control panel for child-protection requests: a switch to block them entirely, and every
 * grant with who looked and when, each ending in one tap. Blocking is instant; turning requests
 * back on needs her password.
 */
export function ChildProtectionSharing() {
  const [policy, setPolicy] = useState<"ask" | "block" | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getCpsInviteSettings();
      setPolicy(s.policy);
      setHasPassword(s.hasPassword);
    } catch {
      setPolicy("block");
    }
    try {
      setGrants(await listMyCpsGrants());
    } catch {
      setGrants([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const block = async () => {
    setBusy(true);
    setError(null);
    try {
      await blockCpsInvitesFn();
      toast("Requests from child-protection professionals are blocked. They are not told.");
      await load();
    } catch {
      setError("We couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const allow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await allowCpsInvitesFn({ data: { password: password || undefined } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setPassword("");
      await load();
    } catch {
      setError("We couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      await revokeCpsGrantFn({ data: { id } });
      toast("Access ended. They can no longer open it.");
      await load();
    } catch {
      toast("We couldn't end that access. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (policy === null) return null;
  return (
    <div id="child-protection" className="card-pp mt-6 scroll-mt-24">
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} style={{ color: "var(--accent)" }} />
        <h2 className="font-serif text-[19px]">Child-protection and social-work requests</h2>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        A verified professional can send you a private link asking to see records. Nothing is shared unless you
        choose exact items. Records an agency has seen may not be possible to take back.
      </p>
      <div className="mt-4 rounded-2xl p-3" style={{ background: "var(--input)" }}>
        <div className="text-[14px] font-semibold">Requests: {policy === "block" ? "Blocked" : "Ask me"}</div>
        {policy === "ask" ? (
          <>
            <p className="mt-1 text-[12px]">If you block them, no email is sent and the sender is not told.</p>
            <button className="btn-primary mt-3" onClick={block} disabled={busy}>
              Block all requests
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[12px]">Turning requests back on needs your password.</p>
            {hasPassword && (
              <input
                aria-label="Account password"
                className="input-pp mt-3"
                type="password"
                autoComplete="current-password"
                placeholder="Account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            <button className="btn-primary mt-3" onClick={allow} disabled={busy || (hasPassword && !password)}>
              Let requests reach me
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="mt-2 text-[12px]" style={{ color: "#9B2C3E" }}>
            {error}
          </p>
        )}
      </div>
      {grants && grants.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {grants.map((g) => (
            <div key={g.id} className="rounded-2xl p-3" style={{ background: "var(--input)" }}>
              <div className="text-[14px] font-semibold">
                {g.worker}
                {g.agency ? ` · ${g.agency}` : ""}
              </div>
              <div className="text-[12px]">
                {g.live ? `Open until ${new Date(g.expiresAt).toLocaleDateString()}` : "Ended"} · {g.itemCount}{" "}
                {g.itemCount === 1 ? "item" : "items"} · opened {g.views} {g.views === 1 ? "time" : "times"}
                {g.lastViewedAt ? `, last ${new Date(g.lastViewedAt).toLocaleString()}` : ""}
              </div>
              {g.live && (
                <button className="btn-secondary mt-2" onClick={() => void revoke(g.id)} disabled={busy}>
                  End access now
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
