import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  inviteAttorneyDirect,
  reviewAttorneyApplication,
  type FounderOverview,
} from "@/lib/founder-ops.functions";

interface AttorneyRequestsPanelProps {
  applications: FounderOverview["applications"];
  onChange: () => void;
}

export function AttorneyRequestsPanel({ applications, onChange }: AttorneyRequestsPanelProps) {
  const review = useServerFn(reviewAttorneyApplication);
  const invite = useServerFn(inviteAttorneyDirect);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : "That didn't go through. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-pp" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, margin: 0 }}>Attorney requests</h2>
      <form
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => invite({ data: { email, full_name: name } }), "Invitation sent.").then(() => {
            setEmail("");
            setName("");
          });
        }}
      >
        <input className="input-pp" aria-label="Attorney name" placeholder="Attorney name" required value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <input className="input-pp" aria-label="Attorney email" type="email" placeholder="Attorney email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn-primary" disabled={busy}>Invite an attorney</button>
      </form>
      {applications.length === 0 ? (
        <p style={{ fontSize: 14, margin: 0 }}>No attorney requests yet. When someone applies, they'll show up here.</p>
      ) : (
        applications.map((a) => (
          <div key={a.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10, fontSize: 14 }}>
            <strong>{a.full_name}</strong> · {a.email}
            <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              {[a.firm_name, a.bar_number && `Bar ${a.bar_number}`, a.jurisdiction].filter(Boolean).join(" · ") || "No firm details"}
              {" · "}
              {a.source === "founder_invite" ? "Invited by you" : "Applied"} · {new Date(a.created_at).toLocaleString()}
            </div>
            {a.status === "pending_review" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn-primary" disabled={busy} onClick={() => act(() => review({ data: { id: a.id, decision: "approved" } }), "Approved. They've been sent a sign-in invitation.")}>Approve</button>
                <button className="btn-secondary" disabled={busy} onClick={() => act(() => review({ data: { id: a.id, decision: "rejected" } }), "Marked as not approved.")}>Decline</button>
              </div>
            ) : (
              <div style={{ fontSize: 13, marginTop: 4 }}>{a.status === "approved" ? "Approved" : "Not approved"}</div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
