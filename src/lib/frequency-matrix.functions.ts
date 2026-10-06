import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MATRIX_THREAD_COLUMNS,
  incompleteExportNote,
  matrixSourcesFromThread,
  readThreadMatrixRows,
  type MatrixThread,
} from "@/lib/frequency-matrix.server";

/**
 * The survivor's own counts for one imported conversation. Reads only her
 * rows (RLS client plus an explicit owner filter) and never selects message
 * text. Numbers are computed in the browser by buildFrequencyMatrix.
 */
export const getMyThreadMatrixData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thread } = await supabase
      .from("message_threads")
      .select(MATRIX_THREAD_COLUMNS)
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("We couldn't find that conversation.");
    const { messages, truncated } = await readThreadMatrixRows(supabase, userId, data.threadId);
    const t = thread as MatrixThread;
    return {
      thread: t,
      messages,
      truncated,
      incomplete: incompleteExportNote(t),
      sources: matrixSourcesFromThread(t),
    };
  });
