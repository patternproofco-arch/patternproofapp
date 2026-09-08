import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getOrgOversight, type OrgOversight as Data } from "@/lib/org-oversight.functions";

/**
 * Team oversight for an organization owner or administrator.
 * Assignment metadata only — never journal entries, evidence or timelines.
 */
export function OrgOversight() {
  const fn = useServerFn(getOrgOversight);
  const [data, setData] = useState<Data | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    fn()
      .then(setData)
      .catch(() => setUnavailable(true));
  }, [fn]);

  if (unavailable || !data) return null;

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Team oversight</h2>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--muted-foreground)",
          lineHeight: 1.6,
          maxWidth: 620,
        }}
      >
        Who is working with whom, and how much. Being an owner here does not open anyone's records:
        journal entries and evidence stay closed unless a survivor has separately shared them with
        you personally. A client is only named when that survivor turned on organization visibility.
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {data.advocates.length === 0 && (
          <p style={{ fontSize: 13 }}>
            No one is on the team yet — when advocates join, their assignments show up here.
          </p>
        )}
        {data.advocates.map((a) => (
          <div key={a.user_id} className="card-pp" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {a.full_name ?? "Team member"}{" "}
                  <span style={{ fontWeight: 500, color: "var(--muted-foreground)" }}>
                    · {a.role}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                  {a.open_clients} open · {a.closed_clients} closed
                  {a.last_activity_at
                    ? ` · last assignment ${new Date(a.last_activity_at).toLocaleDateString()}`
                    : " · no assignments yet"}
                </div>
              </div>
            </div>
            {a.clients.length > 0 && (
              <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 12.5 }}>
                {a.clients.map((c) => (
                  <li key={c.link_id}>
                    {c.label} · {c.status === "active" ? "open" : "closed"}
                    {c.identified ? "" : " · name withheld"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
