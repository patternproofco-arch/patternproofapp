import { createFileRoute, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Users, CreditCard, Lock, LayoutGrid } from "lucide-react";
import { listMyClients } from "@/lib/attorney-portal.functions";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_attorney/clients")({
  component: ClientsLayout,
});

type ClientRow = Awaited<ReturnType<typeof listMyClients>>["clients"][number];

function ClientsLayout() {
  const fetcher = useServerFn(listMyClients);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const sub = useSubscription();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const m = pathname.match(/^\/clients\/([0-9a-f-]{36})/i);
  const activeId = m?.[1] ?? null;

  useEffect(() => { fetcher().then((r) => setClients(r.clients)); }, [fetcher]);

  const firstClient = clients?.[clients.length - 1]?.client_user_id ?? clients?.[0]?.client_user_id; // earliest = last in DESC order
  const earliestId = clients && clients.length
    ? [...clients].sort((a, b) => a.linked_at.localeCompare(b.linked_at))[0].client_user_id
    : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 24 }}>
      <aside style={{ borderRight: "1px solid var(--att-border)", paddingRight: 16, minHeight: "60vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Users size={14} />
          <div className="att-eyebrow" style={{ margin: 0 }}>Clients</div>
        </div>
        <Link
          to="/caseload"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", marginBottom: 8,
            borderRadius: 6, border: "1px solid var(--att-border)",
            fontSize: 12, textDecoration: "none", color: "inherit",
          }}
        >
          <LayoutGrid size={12} /> Caseload capacity
        </Link>
        {clients === null && <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>Loading…</div>}
        {clients && clients.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>No clients yet. When a survivor invites you, they appear here.</div>
        )}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 2 }}>
          {clients?.map((c) => {
            const free = c.client_user_id === earliestId;
            const locked = !sub.isActive && !free;
            const isActive = activeId === c.client_user_id;
            return (
              <li key={c.link_id}>
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: c.client_user_id }}
                  style={{
                    display: "block",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: isActive ? "var(--att-navy)" : "transparent",
                    color: isActive ? "white" : "inherit",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Client {c.client_user_id.slice(0, 8)}</span>
                    {locked ? <Lock size={11} style={{ opacity: 0.8 }} /> : free && !sub.isActive ? <span style={{ fontSize: 10, opacity: 0.8 }}>FREE</span> : null}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                    {c.incident_count} incidents · {c.documentation_density} density
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--att-border)" }}>
          {sub.isActive ? (
            <Link to="/subscribe" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--att-text-2)", textDecoration: "none" }}>
              <CreditCard size={12} /> Manage subscription
            </Link>
          ) : (
            <Link to="/subscribe" className="att-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", fontSize: 12 }}>
              <CreditCard size={12} /> Subscribe — $297/mo
            </Link>
          )}
        </div>
      </aside>
      <div>
        <Outlet />
      </div>
    </div>
  );
}