import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listMyAssignedMatters } from "@/lib/matters.functions";
import { folio } from "@/components/pp/folio";

export const Route = createFileRoute("/_advocate/advocate-matters")({
  head: () => ({
    meta: [
      { title: "Matters shared with you — PatternProof" },
      {
        name: "description",
        content: "Matters an attorney has assigned to you, and the case files attached to them.",
      },
      { property: "og:title", content: "Matters shared with you — PatternProof" },
      {
        property: "og:description",
        content: "Matters an attorney has assigned to you, and the case files attached to them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdvocateMatters,
});

function AdvocateMatters() {
  const list = useServerFn(listMyAssignedMatters);
  const [data, setData] = useState<Awaited<ReturnType<typeof listMyAssignedMatters>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    list()
      .then(setData)
      .catch(() => setErr("We couldn't load your matters just now."));
  }, [list]);

  return (
    <div style={{ ...folio.page, padding: "8px 0 40px" }}>
      <div style={folio.eyebrow}>Assigned by an attorney</div>
      <h1 style={folio.h1}>Matters shared with you</h1>
      <p style={folio.lede}>
        Each matter here was assigned to you by the attorney who opened it. Access can be withdrawn
        by them at any time.
      </p>

      {err && <p style={{ fontSize: 14 }}>{err}</p>}
      {!err && data === null && <p style={folio.lede}>Loading…</p>}
      {data && data.matters.length === 0 && (
        <p style={folio.lede}>
          Nothing here yet — when an attorney assigns you a matter, it will appear here.
        </p>
      )}

      {(data?.matters ?? []).map((m) => (
        <div key={m.id} style={{ padding: "16px 0", borderTop: "1px solid var(--rule)" }}>
          <div style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 18 }}>
            {m.matter_name}
          </div>
          <div style={folio.mono}>
            {[
              m.matter_number ? `No. ${m.matter_number}` : null,
              m.case_type,
              m.court,
              m.jurisdiction,
              m.status === "closed" ? "Closed" : "Open",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {m.client_user_id ? (
            <Link
              to="/advocate-cases/$clientId"
              params={{ clientId: m.client_user_id }}
              style={{ fontSize: 13, color: "var(--indigo)" }}
            >
              Open the shared case file
            </Link>
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              No client file is attached to this matter yet.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
