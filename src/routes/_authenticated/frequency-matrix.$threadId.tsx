import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getMyThreadMatrixData } from "@/lib/frequency-matrix.functions";
import { FrequencyMatrixSheet } from "@/components/FrequencyMatrixSheet";

export const Route = createFileRoute("/_authenticated/frequency-matrix/$threadId")({
  head: () => ({
    meta: [
      { title: "Message counts — PatternProof" },
      {
        name: "description",
        content: "Observed counts from your imported messages on one printable page.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SurvivorFrequencyMatrixPage,
});

function SurvivorFrequencyMatrixPage() {
  const { threadId } = useParams({ from: "/_authenticated/frequency-matrix/$threadId" });
  const fetchData = useServerFn(getMyThreadMatrixData);
  const q = useQuery({
    queryKey: ["my-frequency-matrix", threadId],
    queryFn: () => fetchData({ data: { threadId } }),
  });

  const back = (
    <Link to="/import-messages" className="inline-flex items-center gap-1 text-sm text-primary">
      <ArrowLeft size={14} /> Back to your conversations
    </Link>
  );

  if (q.isLoading) return <p className="p-6 text-muted-foreground">Counting messages…</p>;
  if (q.error || !q.data) {
    return (
      <div className="p-6">
        <div className="mb-4">{back}</div>
        <p className="text-sm text-muted-foreground">
          We couldn't open that conversation. It may have been deleted.
        </p>
      </div>
    );
  }

  const t = q.data.thread;
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
      toolbarStart={
        <div>
          {back}
          <p className="mt-2 max-w-md text-xs text-muted-foreground">
            Plain counts and dates from this conversation, on one page you can print or copy.
          </p>
        </div>
      }
    />
  );
}
