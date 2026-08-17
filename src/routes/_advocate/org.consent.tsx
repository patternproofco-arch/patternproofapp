import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listAdvocateClients } from "@/lib/advocate.functions";

export const Route = createFileRoute("/_advocate/org/consent")({
  component: ConsentCentre,
});

type Clients = Awaited<ReturnType<typeof listAdvocateClients>>["clients"];

function ConsentCentre() {
  const listFn = useServerFn(listAdvocateClients);
  const [clients, setClients] = useState<Clients | null>(null);

  useEffect(() => { listFn().then((r) => setClients(r.clients)).catch(() => setClients([])); }, [listFn]);

  return (
    <>
      <p className="orgx-eyebrow">Consent</p>
      <h1 style={{ margin: "8px 0 10px" }}>Consent centre</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 660 }}>
        Every workspace shared with this account, and a plain-language receipt for each one: who
        received access, what it covers, when it started, and whether it is still in force.
      </p>

      {!clients ? (
        <p className="orgx-muted" style={{ fontSize: 14, marginTop: 26 }}>Loading…</p>
      ) : clients.length === 0 ? (
        <div className="orgx-empty" style={{ marginTop: 24 }}>
          Nothing here yet — a consent receipt appears once someone shares a workspace with you.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
          {clients.map((c) => {
            const active = c.status === "active";
            return (
              <div key={c.id} className="orgx-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0 }}>{c.case_label ?? "Shared workspace"}</h2>
                  <span className="orgx-chip" data-tone={active ? "active" : "ended"}>
                    {active ? "In force" : "Withdrawn"}
                  </span>
                </div>
                <dl style={{ display: "grid", gap: 8, margin: "14px 0 0", fontSize: 13.5 }}>
                  <Receipt label="Who received access" value="This organization account only." />
                  <Receipt
                    label="What it covers"
                    value="The incident entries and evidence descriptions the person chose to include. No files, no locations beyond what they wrote, no attachments."
                  />
                  <Receipt label="Download rights" value="None. Nothing in a shared workspace can be downloaded from this portal." />
                  <Receipt label="Started" value={new Date(c.created_at).toLocaleDateString()} />
                  <Receipt
                    label="Ends"
                    value={
                      active
                        ? "No end date set. The person can withdraw access at any time, which takes effect immediately."
                        : `Withdrawn${c.revoked_at ? ` on ${new Date(c.revoked_at).toLocaleDateString()}` : ""}. Access is blocked.`
                    }
                  />
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Receipt({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <dt className="orgx-muted" style={{ fontSize: 12 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}
