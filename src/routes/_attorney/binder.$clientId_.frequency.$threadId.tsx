import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getClientThreadMatrixData } from "@/lib/attorney-portal.functions";
import { FrequencyMatrixSheet } from "@/components/FrequencyMatrixSheet";
import { AttorneyBinderEmpty } from "@/components/attorney/AttorneyBinderEmpty";
import { useChronologyWorkspace } from "@/components/attorney/ChronologyWorkspace";
import { gatePacketOutput } from "@/lib/packet-output";

export const Route = createFileRoute("/_attorney/binder/$clientId_/frequency/$threadId")({
  head: () => ({
    meta: [
      { title: "Message frequency matrix — PatternProof" },
      {
        name: "description",
        content: "Observed counts from imported messages on one printable page.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttorneyFrequencyMatrixPage,
});

function AttorneyFrequencyMatrixPage() {
  const { clientId, threadId } = useParams({
    from: "/_attorney/binder/$clientId_/frequency/$threadId",
  });
  const fetchData = useServerFn(getClientThreadMatrixData);
  const wsQ = useChronologyWorkspace(clientId);
  const q = useQuery({
    queryKey: ["binder-frequency-matrix", clientId, threadId],
    queryFn: () => fetchData({ data: { clientId, threadId } }),
  });

  const back = (
    <Link
      to="/binder/$clientId"
      params={{ clientId }}
      className="inline-flex items-center gap-1 text-sm text-primary"
    >
      <ArrowLeft size={14} /> Back to binder
    </Link>
  );

  if (q.isLoading) return <p className="p-8 text-muted-foreground">Counting messages…</p>;
  if (q.error || !q.data) {
    const msg = q.error instanceof Error ? q.error.message : "";
    const ended = /no active|revok|expir|ended|withdraw/i.test(msg);
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">{back}</div>
        <AttorneyBinderEmpty
          variant={ended ? "access_ended" : "nothing_shared"}
          clientId={clientId}
          hasMessaging
        />
      </div>
    );
  }

  const t = q.data.thread;
  const pkg = wsQ.data?.package ?? null;
  const gate = gatePacketOutput({
    packageVersion: pkg?.version ?? null,
    packageDiff: pkg?.diff ?? null,
  });
  const incomplete = q.data.incomplete;
  return (
    <FrequencyMatrixSheet
      messages={q.data.messages}
      truncated={q.data.truncated}
      storedMessageCount={t.message_count}
      incompleteExport={incomplete?.incomplete}
      incompleteReason={incomplete?.reason}
      sources={q.data.sources}
      conversation={t.conversation_participant || t.source_filename || "Imported conversation"}
      source={t.source_filename}
      importedAt={t.created_at}
      packageVersion={pkg?.version ?? null}
      packageBlockedReason={gate.ok ? null : gate.reasons[0] ?? null}
      toolbarStart={back}
    />
  );
}
