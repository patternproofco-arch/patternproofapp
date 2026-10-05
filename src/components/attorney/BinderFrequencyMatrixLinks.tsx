import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listClientThreads } from "@/lib/attorney-portal.functions";

type ThreadRow = {
  id: string;
  source_filename: string | null;
  conversation_participant: string | null;
  message_count: number | null;
  created_at: string;
};

/**
 * Binder entry point for the 1-page message frequency matrix. Lists only the
 * threads this attorney can already open (same rule as the Threads tab).
 */
export function BinderFrequencyMatrixLinks({ clientId }: { clientId: string }) {
  const listFn = useServerFn(listClientThreads);
  const q = useQuery({
    queryKey: ["binder-threads", clientId],
    queryFn: () => listFn({ data: { clientId } }),
  });
  const threads = ((q.data?.threads ?? []) as ThreadRow[]).filter(
    (t) => (t.message_count ?? 0) > 0,
  );
  if (q.isLoading || threads.length === 0) return null;

  return (
    <section className="mb-10 print:hidden">
      <h2 className="mb-2 font-display text-lg">Message frequency matrix</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        One printable page of observed counts per imported conversation: messages by period and
        sender, and by day of week and time of day. Counts and dates only.
      </p>
      <ul className="space-y-1 text-sm">
        {threads.map((t) => (
          <li key={t.id}>
            <Link
              to="/binder/$clientId/frequency/$threadId"
              params={{ clientId, threadId: t.id }}
              className="text-primary underline"
            >
              {t.conversation_participant || t.source_filename || "Imported conversation"}
            </Link>{" "}
            <span className="text-muted-foreground">· {t.message_count} imported messages</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
