import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { listAdvocateClients } from "@/lib/advocate.functions";

export const Route = createFileRoute("/_advocate/advocate-cases/")({
  component: AdvocateCases,
});

type Clients = Awaited<ReturnType<typeof listAdvocateClients>>["clients"];

function AdvocateCases() {
  const listFn = useServerFn(listAdvocateClients);
  const [clients, setClients] = useState<Clients | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listFn().then((r) => setClients(r.clients)).catch(() => setClients([]));
  }, [listFn]);

  const q = query.trim().toLowerCase();
  const visible = clients?.filter((c) => !q || (c.case_label ?? "shared workspace").toLowerCase().includes(q)) ?? null;

  return (
    <>
      <p className="orgx-eyebrow">Shared workspaces</p>
      <h1 style={{ fontSize: 40, margin: "8px 0 10px" }}>Shared survivors</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 620 }}>
        Each workspace below is shared by the person it belongs to. You can view only what they have chosen to
        share, and they can withdraw that access at any time.
      </p>

      <div
        className="orgx-panel"
        style={{ display: "flex", alignItems: "flex-start", gap: 14, margin: "28px 0 8px" }}
      >
        <Lock size={18} strokeWidth={1.7} aria-hidden style={{ marginTop: 2, color: "var(--ox-sage)" }} />
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Unshared material is not visible.</div>
          <p className="orgx-muted" style={{ fontSize: 13.5, margin: "2px 0 0" }}>
            Records that were not included in a share never appear here, and nothing is downloadable from this view.
          </p>
        </div>
      </div>

      {clients && clients.length > 0 ? (
        <label style={{ display: "block", marginTop: 26, maxWidth: 340 }}>
          <span className="orgx-muted" style={{ fontSize: 12.5 }}>Find a shared workspace</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by workspace label"
            className="orgx-input"
          />
        </label>
      ) : null}

      {!visible ? (
        <p style={{ fontSize: 13.5, marginTop: 28 }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p className="orgx-muted" style={{ fontSize: 14.5, marginTop: 28 }}>
          {q
            ? "No shared workspace matches that search."
            : "Nothing here yet — a workspace will appear once someone shares one with you."}
        </p>
      ) : (
        <div className="orgx-rowlist" style={{ marginTop: 20 }}>
          {visible.map((c) => {
            const active = c.status === "active";
            return (
              <div key={c.id} className="orgx-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 19 }}>{c.case_label ?? "Shared workspace"}</span>
                    <span className="orgx-pill">{active ? "Sharing active" : "Access withdrawn"}</span>
                  </div>
                  <div className="orgx-muted" style={{ fontSize: 13 }}>
                    Access granted {new Date(c.created_at).toLocaleDateString()}
                    {!active && c.revoked_at ? ` · withdrawn ${new Date(c.revoked_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                {active ? (
                  <Link to="/advocate-cases/$clientId" params={{ clientId: c.client_user_id }} className="orgx-btn orgx-btn-quiet">
                    Open workspace
                  </Link>
                ) : (
                  <span className="orgx-muted" style={{ fontSize: 13 }}>Access withdrawn</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
