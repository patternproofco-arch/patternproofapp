import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { STATE_RESOURCES, US_STATES } from "@/lib/state-resources";

export const Route = createFileRoute("/_advocate/org/resources")({
  component: Resources,
});

function Resources() {
  const [state, setState] = useState("");
  const list = state ? (STATE_RESOURCES[state] ?? []) : [];

  return (
    <>
      <p className="orgx-eyebrow">Resources</p>
      <h1 style={{ margin: "8px 0 10px" }}>Resources and referrals</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 660 }}>
        Organisations you can point someone towards. Nothing on this page touches anyone's records.
      </p>

      <div className="orgx-card" style={{ marginTop: 22 }}>
        <h2 style={{ margin: 0 }}>National</h2>
        <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 8, fontSize: 14 }}>
          <li>National Domestic Violence Hotline — 1-800-799-7233, or text START to 88788.</li>
          <li>
            <a href="https://www.thehotline.org" target="_blank" rel="noreferrer">thehotline.org</a> — chat and safety planning.
          </li>
          <li>
            <a href="https://www.womenslaw.org" target="_blank" rel="noreferrer">womenslaw.org</a> — state-by-state legal information.
          </li>
        </ul>
        <p className="orgx-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
          If a device may be monitored, use a phone or computer the other person cannot reach.
        </p>
      </div>

      <hr className="orgx-rule" />

      <h2 className="orgx-eyebrow" style={{ marginBottom: 12 }}>By state</h2>
      <label style={{ display: "block", maxWidth: 320, fontSize: 13.5 }}>
        <span className="orgx-muted">Choose a state</span>
        <select className="orgx-input" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Select…</option>
          {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </label>

      {state && list.length === 0 ? (
        <div className="orgx-empty" style={{ marginTop: 20 }}>
          We don't have a coalition listed for that state yet.
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {list.map((r) => (
          <div key={r.name} className="orgx-card">
            <h3 style={{ margin: 0 }}>{r.name}</h3>
            <p className="orgx-muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>
              {r.issueCovered} · {r.jurisdiction}
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 14 }}>
              <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
              {r.phone ? <> · {r.phone}</> : null}
            </p>
            <p className="orgx-muted" style={{ margin: "8px 0 0", fontSize: 12.5 }}>
              {r.humanContactMethod} · {r.safeDeviceWarning}
            </p>
            <p className="orgx-muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
              {r.dateLastChecked ? `Last checked ${r.dateLastChecked}` : "Not individually re-verified by us — confirm before relying on it."}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
