import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { getFounderOverview, type FounderOverview } from "@/lib/founder-ops.functions";
import { AttorneyRequestsPanel } from "@/components/admin/AttorneyRequestsPanel";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Founder dashboard — PatternProof" },
      { name: "description", content: "Staff view of help requests, attorney requests and new accounts." },
      { property: "og:title", content: "Founder dashboard — PatternProof" },
      { property: "og:description", content: "Staff view of help requests, attorney requests and new accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FounderDashboard,
});

const h2 = { fontFamily: "var(--font-serif)", fontSize: 20, margin: 0 } as const;
const row = { borderTop: "1px solid var(--border)", paddingTop: 10, fontSize: 14 } as const;
const muted = { color: "var(--ink-muted)", fontSize: 13 } as const;

function FounderDashboard() {
  const fn = useServerFn(getFounderOverview);
  const [data, setData] = useState<FounderOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fn()
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch(() => setError("We couldn't load this. It's only open to PatternProof staff."));
  }, [fn]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: 0 }}>Founder dashboard</h1>
        <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
          <Link to="/admin/support">Reply to help requests</Link>
          <Link to="/admin/signins">Sign-in counts</Link>
          <button className="btn-primary" onClick={load}>Refresh</button>
        </div>
      </div>
      <p style={{ ...muted, margin: 0 }}>
        Email alerts still go to patternproofco@gmail.com. This page shows the same things so nothing waits on an inbox. It never shows anything people wrote in their records.
      </p>
      {error ? <p>{error}</p> : null}
      {data ? (
        <>
          <AttorneyRequestsPanel applications={data.applications} onChange={load} />
          <section className="card-pp" style={{ display: "grid", gap: 10 }}>
            <h2 style={h2}>Help requests</h2>
            {data.support.length === 0 ? <p style={{ margin: 0 }}>No help requests yet. That's a quiet inbox.</p> : null}
            {data.support.map((s) => (
              <div key={s.id} style={row}>
                <strong>{s.name || "No name"}</strong> · {s.reply_email} · {s.category}
                <div style={muted}>{new Date(s.created_at).toLocaleString()} · {s.status}</div>
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{s.message}</p>
              </div>
            ))}
          </section>
          <section className="card-pp" style={{ display: "grid", gap: 10 }}>
            <h2 style={h2}>New accounts</h2>
            {data.signups.map((u) => (
              <div key={u.email + u.created_at} style={row}>
                {u.email} · {u.roles.length ? u.roles.join(", ") : "no role yet"}
                <div style={muted}>{new Date(u.created_at).toLocaleString()} · {u.confirmed ? "email confirmed" : "not confirmed yet"}</div>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
