import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { describeStoredDate } from "@/lib/incident-date";

export type IncidentRevision = {
  id: string;
  changedAt: string;
  description: string;
  dateText: string;
};

export const listIncidentRevisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ incident_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<IncidentRevision[]> => {
    const { data: rows, error } = await context.supabase
      .from("incident_revisions")
      .select("id,changed_at,prior_record")
      .eq("incident_id", data.incident_id)
      .eq("user_id", context.userId)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100);
    if (error) throw new Error("We couldn't load correction history. Try again.");
    return (rows ?? []).map((r) => {
      const prior = r.prior_record as {
        description?: string;
        date?: string | null;
        date_precision?: string | null;
        date_range_start?: string | null;
        date_range_end?: string | null;
      };
      return {
        id: r.id,
        changedAt: r.changed_at,
        description: prior.description ?? "",
        dateText: describeStoredDate(prior),
      };
    });
  });
