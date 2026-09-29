import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { getSigninActivity, type SigninActivity } from "@/lib/signin-activity.functions";

export const Route = createFileRoute("/_authenticated/admin/signins")({
  head: () => ({
    meta: [
      { title: "Sign-in activity — PatternProof" },
      { name: "description", content: "Staff view of sign-up and sign-in counts." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SigninActivityPage,
});

function SigninActivityPage() {
  const fn = useServerFn(getSigninActivity);
  const [data, setData] = useState<SigninActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fn()
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch(() => setError("We couldn't load activity. This page is for PatternProof staff."));
  }, [fn]);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: 0 }}>Sign-in activity</h1>
        <button className="btn-primary" onClick={load}>Refresh</button>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0 }}>
        Counts only — no names, emails, or records. "Unfinished" means someone signed up but never confirmed their email or never signed in. Updates every 30 seconds.
      </p>
      {error ? <p style={{ fontSize: 14 }}>{error}</p> : null}
      {data ? (
        <div className="card-pp" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Period</th><th>Sign-ups</th><th>Confirmed</th><th>Signed in</th><th>Unfinished</th>
              </tr>
            </thead>
            <tbody>
              {data.windows.map((w) => (
                <tr key={w.label}>
                  <td style={{ padding: "8px 0" }}>{w.label}</td>
                  <td>{w.signups}</td><td>{w.confirmed}</td><td>{w.signins}</td><td>{w.abandoned}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
            {data.total} accounts · updated {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      ) : null}
    </div>
  );
}
