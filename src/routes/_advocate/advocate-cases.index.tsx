import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listAdvocateClients } from "@/lib/advocate.functions";

export const Route = createFileRoute("/_advocate/advocate-cases/")({
  component: AdvocateCases,
});

type Clients = Awaited<ReturnType<typeof listAdvocateClients>>["clients"];

function AdvocateCases() {
  const listFn = useServerFn(listAdvocateClients);
  const [clients, setClients] = useState<Clients | null>(null);

  useEffect(() => {
    listFn().then((r) => setClients(r.clients)).catch(() => setClients([]));
  }, [listFn]);

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Cases shared with you</h1>
      <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", marginBottom: 20 }}>
        Read-only. Access is given by the survivor and can be withdrawn by her at any time.
      </p>

      {!clients ? (
        <p style={{ fontSize: 13 }}>Loading…</p>
      ) : clients.length === 0 ? (
        <div className="card-pp" style={{ padding: 20 }}>
          <p style={{ fontSize: 14 }}>Nothing here yet — a case will appear once someone shares one with you.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {clients.map((c) => {
            const active = c.status === "active";
            return (
              <div key={c.id} className="card-pp" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.case_label ?? "Case"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    Access granted {new Date(c.created_at).toLocaleDateString()}
                    {!active && c.revoked_at ? ` · withdrawn ${new Date(c.revoked_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                {active ? (
                  <Link to="/advocate-cases/$clientId" params={{ clientId: c.client_user_id }} className="btn-pp">
                    Open
                  </Link>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Access withdrawn</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}