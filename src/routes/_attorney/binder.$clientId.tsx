import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { getClientCase } from "@/lib/attorney-portal.functions";
import { listClientEvidenceRequests } from "@/lib/evidence-requests.functions";
import { buildBinderEntries } from "@/lib/binder";
import { CourtTimeline } from "@/components/CourtTimeline";
import { BinderExhibits } from "@/components/BinderExhibits";
import { PleadingIndex } from "@/components/PleadingIndex";
import { AttorneyBinderEmpty } from "@/components/attorney/AttorneyBinderEmpty";
import { ChronologyWorkspace, useChronologyWorkspace } from "@/components/attorney/ChronologyWorkspace";

export const Route = createFileRoute("/_attorney/binder/$clientId")({
  head: () => ({
    meta: [
      { title: "Exhibit binder — PatternProof" },
      { name: "description", content: "Shared entries, files and answered requests in date order." },
      { property: "og:title", content: "Exhibit binder — PatternProof" },
      { property: "og:description", content: "Shared entries, files and answered requests in date order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BinderPage,
});

function BinderPage() {
  const { clientId } = useParams({ from: "/_attorney/binder/$clientId" });
  const fetchCase = useServerFn(getClientCase);
  const fetchRequests = useServerFn(listClientEvidenceRequests);
  const caseQ = useQuery({
    queryKey: ["binder-case", clientId],
    queryFn: () => fetchCase({ data: { clientId } }),
  });
  const reqQ = useQuery({
    queryKey: ["binder-requests", clientId],
    queryFn: () => fetchRequests({ data: { clientId } }),
  });
  // Frozen exhibit numbers, when the attorney has fixed them. Without a package the
  // numbers below are only the order of dates and can change as items are added.
  const wsQ = useChronologyWorkspace(clientId);

  if (caseQ.isLoading || reqQ.isLoading) {
    return <p className="p-8 text-muted-foreground">Putting the binder together…</p>;
  }
  if (caseQ.error || !caseQ.data) {
    const msg = caseQ.error instanceof Error ? caseQ.error.message : "";
    const ended =
      /no active|revok|expir|ended|withdraw/i.test(msg) ||
      /sharing may have ended/i.test(msg);
    return (
      <div className="mx-auto max-w-3xl p-6">
        <AttorneyBinderEmpty
          variant={ended ? "access_ended" : "nothing_shared"}
          clientId={clientId}
          hasMessaging
        />
      </div>
    );
  }

  const incidents = caseQ.data.incidents ?? [];
  const evidence = caseQ.data.evidence ?? [];
  const frozen = wsQ.data?.package ? wsQ.data : null;
  const exhibitLabels = frozen ? new Map(frozen.rows.map((r) => [r.key, r.exhibit.label])) : undefined;
  const entries = buildBinderEntries(incidents, evidence, reqQ.data?.items ?? [], exhibitLabels);

  if (incidents.length === 0 && evidence.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6 print:hidden">
          <Link
            to="/clients/$clientId"
            params={{ clientId }}
            className="inline-flex items-center gap-1 text-sm text-primary"
          >
            <ArrowLeft size={14} /> Back to client
          </Link>
        </div>
        <AttorneyBinderEmpty variant="nothing_shared" clientId={clientId} hasMessaging />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1 text-sm text-primary"
        >
          <ArrowLeft size={14} /> Back to client
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          <Printer size={14} /> Download as PDF
        </button>
      </div>
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="font-display text-2xl">Draft Case Summary for Professional Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Exhibit binder · only items the client chose to share · User-reviewed, not court-verified ·
          Generated {new Date().toLocaleDateString()}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {frozen?.package
            ? `Exhibit numbers are fixed (package v${frozen.package.version}). Items shared since then show as "Not yet numbered".`
            : "Exhibit numbers are provisional (date order) and can change if items are added. Fix them below before citing them."}
        </p>
      </header>
      {incidents.length > 0 && evidence.length === 0 ? (
        <div className="mb-6 print:hidden">
          <AttorneyBinderEmpty variant="notes_not_files" clientId={clientId} hasMessaging />
        </div>
      ) : null}
      <section className="mb-8 break-after-page">
        <h2 className="mb-3 font-display text-lg">Court timeline</h2>
        <CourtTimeline entries={entries} />
      </section>
      <PleadingIndex entries={entries} />
      <ChronologyWorkspace clientId={clientId} />
      <BinderExhibits entries={entries} />
    </div>
  );
}
