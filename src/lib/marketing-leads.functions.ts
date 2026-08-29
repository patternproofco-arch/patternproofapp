import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(255),
  // Phone is only ever collected for attorney/org personas — the persona
  // enum itself excludes "survivor", so there is no code path where a
  // survivor-facing form could submit one through this function.
  phone: z.string().trim().max(40).optional(),
  persona: z.enum(["attorney", "org"]),
  sourcePage: z.string().trim().max(200).optional(),
});

export const submitMarketingLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("marketing_leads")
      .insert({
        name: data.name || null,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        persona: data.persona,
        source_page: data.sourcePage || null,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false as const, emailed: false as const };
    }

    const { enqueueMarketingLeadEmail } = await import("@/lib/marketing-leads.server");
    const emailed = await enqueueMarketingLeadEmail({
      id: row.id,
      email: data.email,
      name: data.name || null,
      persona: data.persona,
    });

    return { ok: true as const, emailed };
  });
