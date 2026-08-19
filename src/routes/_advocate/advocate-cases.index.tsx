import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { FolderOpen, Clock3 } from "lucide-react";
import { listAdvocateClients } from "@/lib/advocate.functions";
import { PortalStatHero } from "@/components/shared/PortalStatHero";
import { RecentActivityList, type ActivityRow } from "@/components/shared/RecentActivityList";
import { portalTheme } from "@/components/shared/portal-theme";
import { FocusRegion } from "@/components/survivor/focus-mode";

export const Route = createFileRoute("/_advocate/advocate-cases/")({
  component: AdvocateCases,
});

type Clients = Awaited<ReturnType<typeof listAdvocateClients>>["clients"];

function AdvocateCases() {
  const t = portalTheme("advocate");
  const listFn = useServerFn(listAdvocateClients);
  const [clients, setClients] = useState<Clients | null>(null);

  useEffect(() => {
    listFn().then((r) => setClients(r.clients)).catch(() => setClients([]));
  }, [listFn]);

  const active = (clients ?? []).filter((c) => c.status === "active");
  const withdrawn = (clients ?? []).filter((c) => c.status !== "active");

  // Ranked: most recently shared first — the ones most likely to need follow-up.
  const followUp: ActivityRow[] | null =
    clients === null
      ? null
      : active.map((c) => ({
          id: c.id,
          icon: FolderOpen,
          title: c.case_label ?? "Case",
          timestamp: `shared ${new Date(c.created_at).toLocaleDateString()}`,
          to: "/advocate-cases/$clientId",
          params: { clientId: c.client_user_id },
          highlight: true,
        }));

  const closed: ActivityRow[] = withdrawn.map((c) => ({
    id: c.id,
    icon: Clock3,
    title: c.case_label ?? "Case",
    timestamp: c.revoked_at ? `access withdrawn ${new Date(c.revoked_at).toLocaleDateString()}` : "access withdrawn",
  }));

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PortalStatHero
        variant="advocate"
        eyebrow="Your caseload"
        heading="Cases shared with you"
        value={clients === null ? "—" : active.length}
        label={active.length === 1 ? "case open to you" : "cases open to you"}
        message="Read-only. Access is given by the survivor and can be withdrawn by her at any time."
      />

      <FocusRegion id="advocate-followup">
        <RecentActivityList
          variant="advocate"
          title="Needs follow-up"
          rows={followUp}
          emptyMessage="Nothing here yet — a case will appear once someone shares one with you."
        />
      </FocusRegion>

      {closed.length > 0 ? (
        <FocusRegion id="advocate-closed">
          <RecentActivityList variant="advocate" title="No longer shared" rows={closed} />
        </FocusRegion>
      ) : null}

      <p style={{ margin: 0, fontSize: 12, color: t.muted }}>
        <Link to="/advocate-cases" style={{ color: t.accent }}>
          Refresh your list
        </Link>{" "}
        if something looks out of date.
      </p>
    </div>
  );
}
