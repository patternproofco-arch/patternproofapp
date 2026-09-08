import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  approveOrgAccessByEmail,
  listOrgAccessRequests,
  reviewOrgAccessRequest,
} from "@/lib/org-portal.functions";

export const Route = createFileRoute("/_authenticated/admin/org-requests")({
  head: () => ({
    meta: [
      { title: "Partner verification — PatternProof" },
      {
        name: "description",
        content: "Review and approve DV organization access requests for the PatternProof partner portal.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrgRequestsAdmin,
});

type Request = Awaited<ReturnType<typeof listOrgAccessRequests>>["requests"][number];

function OrgRequestsAdmin() {
  const listFn = useServerFn(listOrgAccessRequests);
  const reviewFn = useServerFn(reviewOrgAccessRequest);
  const approveFn = useServerFn(approveOrgAccessByEmail);

  const [rows, setRows] = useState<Request[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");

  const load = useCallback(() => {
    listFn()
      .then((r) => {
        setRows(r.requests);
        setError(null);
      })
      .catch(() => setError("We couldn't load partner requests. Try again in a moment."));
  }, [listFn]);

  useEffect(load, [load]);

  const decide = async (id: string, decision: "approved" | "denied") => {
    setBusy(true);
    try {
      await reviewFn({ data: { id, decision } });
      toast(decision === "approved" ? "Approved. They can finish setup now." : "Marked as denied.");
      load();
    } catch {
      toast("We couldn't save that decision. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const addApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await approveFn({
        data: { email: email.trim(), org_name: orgName.trim(), contact_name: contactName.trim() },
      });
      toast("Approved. They can finish setup at /org-signup.");
      setEmail("");
      setOrgName("");
      setContactName("");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "We couldn't save that approval.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px", display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: 0 }}>
          Partner verification
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
          Organization portals stay invitation-only. Approving an address lets that organization
          finish its own setup at <code>/org-signup</code>.
        </p>
      </div>

      <form onSubmit={addApproval} className="card-pp" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, margin: 0 }}>
          Approve an organization directly
        </h2>
        <input
          className="input-pp"
          type="email"
          required
          placeholder="Work email of the person who will set it up"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input-pp"
          required
          minLength={2}
          placeholder="Organization name"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />
        <input
          className="input-pp"
          required
          placeholder="Contact name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Approve"}
        </button>
      </form>

      {error ? <p style={{ fontSize: 14 }}>{error}</p> : null}

      {rows && rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Nothing waiting right now — new requests will appear here.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {(rows ?? []).map((r) => (
          <div key={r.id} className="card-pp" style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>{r.org_name}</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              {r.contact_name}
              {r.contact_role ? ` · ${r.contact_role}` : ""} · {r.email}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {[
                r.org_type,
                r.service_area,
                r.website,
                r.phone,
                r.survivors_per_month ? `${r.survivors_per_month}/month` : null,
                r.contact_consent ? "consented to contact" : "no contact consent",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {r.message ? <div style={{ fontSize: 13 }}>{r.message}</div> : null}
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Status: {r.status}
              {r.reviewed_at ? ` · reviewed ${new Date(r.reviewed_at).toLocaleString()}` : ""}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-primary"
                disabled={busy || r.status === "approved"}
                onClick={() => decide(r.id, "approved")}
              >
                Approve
              </button>
              <button
                disabled={busy || r.status === "denied"}
                onClick={() => decide(r.id, "denied")}
                style={{
                  background: "transparent",
                  border: "none",
                  textDecoration: "underline",
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                }}
              >
                Not a fit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
