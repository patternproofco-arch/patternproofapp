import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { getClientCase } from "@/lib/attorney-portal.functions";
import { listClientEvidenceRequests } from "@/lib/evidence-requests.functions";
import { buildBinderEntries, type BinderEntry } from "@/lib/binder";
import { CourtTimeline } from "@/components/CourtTimeline";

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

  if (caseQ.isLoading || reqQ.isLoading) {
    return <p className="p-8 text-muted-foreground">Putting the binder together…</p>;
  }
  if (caseQ.error || !caseQ.data) {
    return (
      <p className="p-8 text-muted-foreground">
        We couldn't open this binder. Sharing may have ended — try again from the client page.
      </p>
    );
  }

  const entries = buildBinderEntries(
    caseQ.data.incidents ?? [],
    caseQ.data.evidence ?? [],
    reqQ.data?.items ?? [],
  );

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
      </header>
      <section className="mb-8 break-after-page">
        <h2 className="mb-3 font-display text-lg">Court timeline</h2>
        <CourtTimeline entries={entries} />
      </section>
      {entries.length > 0 && (
        <ol className="space-y-4">
          {entries.map((e) => (
            <BinderRow key={`${e.kind}-${e.id}`} entry={e} />
          ))}
        </ol>
      )}
    </div>
  );
}

function BinderRow({ entry }: { entry: BinderEntry }) {
  return (
    <li className="break-inside-avoid rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {entry.exhibit} · {entry.label}
        </span>
        <span className="text-xs text-muted-foreground">{entry.date ?? "Date not given"}</span>
      </div>
      <h2 className="mt-1 font-medium">{entry.title}</h2>
      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
    </li>
  );
}
