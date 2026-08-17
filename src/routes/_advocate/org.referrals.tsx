import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Copy, Power } from "lucide-react";
import { toast } from "sonner";
import { getMyOrgPartnerStats, setReferralCodeActive, type OrgPartnerStats } from "@/lib/org-portal.functions";

export const Route = createFileRoute("/_advocate/org/referrals")({
  component: Referrals,
});

const STATUS_LABEL: Record<string, string> = {
  actively_documenting: "Actively documenting",
  inactive: "Quiet lately",
  signed_up: "Signed up",
};

function Referrals() {
  const statsFn = useServerFn(getMyOrgPartnerStats);
  const toggleFn = useServerFn(setReferralCodeActive);
  const [stats, setStats] = useState<OrgPartnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    statsFn()
      .then((s) => { setStats(s); setError(null); })
      .catch(() => setError("We couldn't open your referral links. Try again in a moment."));
  }, [statsFn]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (code: string, next: boolean) => {
    setConfirming(null);
    try {
      await toggleFn({ data: { code, is_active: next } });
      toast.success(next ? "Link turned back on." : "Link turned off. New sign-ups won't be attributed to it.");
      load();
    } catch {
      toast.error("We couldn't change that link. Try again in a moment.");
    }
  };

  return (
    <>
      <p className="orgx-eyebrow">Referrals</p>
      <h1 style={{ margin: "8px 0 10px" }}>Referrals</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 660 }}>
        Counts only. A referral tells us someone arrived through your link — it never tells us who they
        are, and it gives your organization no access to anything they write.
      </p>

      {error ? <div className="orgx-empty" style={{ marginTop: 24 }}>{error}</div> : null}

      {stats ? (
        <>
          <hr className="orgx-rule" />
          <h2 className="orgx-eyebrow" style={{ marginBottom: 14 }}>Your referral links</h2>
          {stats.codes.length === 0 ? (
            <div className="orgx-empty">
              Nothing here yet — your referral link will appear once we finish setting up your organization.
            </div>
          ) : (
            <div className="orgx-rowlist">
              {stats.codes.map((c) => {
                const url = `https://pattern-proof.tech/login?ref=${c.code}`;
                return (
                  <div key={c.code} className="orgx-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                      <code style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>{url}</code>
                      <span className="orgx-muted" style={{ fontSize: 13 }}>
                        {c.is_active ? "Active" : "Turned off"} · {c.referred_count}{" "}
                        {c.referred_count === 1 ? "person" : "people"} signed up through this link
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="orgx-btn orgx-btn-quiet"
                        onClick={() => { navigator.clipboard?.writeText(url); toast.success("Copied."); }}
                      >
                        <Copy size={15} aria-hidden /> Copy link
                      </button>
                      {confirming === c.code ? (
                        <>
                          <button type="button" className="orgx-btn" onClick={() => toggle(c.code, !c.is_active)}>
                            {c.is_active ? "Yes, turn it off" : "Yes, turn it on"}
                          </button>
                          <button type="button" className="orgx-btn orgx-btn-quiet" onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" className="orgx-btn orgx-btn-quiet" onClick={() => setConfirming(c.code)}>
                          <Power size={15} aria-hidden /> {c.is_active ? "Turn off" : "Turn back on"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <hr className="orgx-rule" />
          <h2 className="orgx-eyebrow" style={{ marginBottom: 14 }}>Referred sign-ups</h2>
          {stats.referred.length === 0 ? (
            <div className="orgx-empty">
              Nothing here yet — when someone signs up through your link, they'll show up as a count.
            </div>
          ) : (
            <table className="orgx-table">
              <thead>
                <tr><th scope="col">Joined</th><th scope="col">Link</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {stats.referred.map((r, i) => (
                  <tr key={i}>
                    <td>{r.signed_up_month}</td>
                    <td><code style={{ fontSize: 13 }}>{r.code}</code></td>
                    <td><span className="orgx-chip" data-tone={r.status === "actively_documenting" ? "active" : "ended"}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="orgx-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
            "Actively documenting" means at least one new entry in the last {stats.active_window_days} days. We never
            show what was written, and these rows are not linked to any shared workspace.
          </p>
        </>
      ) : !error ? (
        <p className="orgx-muted" style={{ fontSize: 14, marginTop: 26 }}>Loading…</p>
      ) : null}
    </>
  );
}
