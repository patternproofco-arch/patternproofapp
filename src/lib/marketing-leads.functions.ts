import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional(),
  persona: z.enum(["attorney", "org"]),
  sourcePage: z.enum(["/for-attorneys", "/for-organizations"]),
});

export const requestProfessionalReadinessKit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: row, error } = await db
      .from("marketing_leads")
      .insert({
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        persona: data.persona,
        source_page: data.sourcePage,
      })
      .select("id")
      .single();

    if (error || !row?.id) {
      return { ok: false as const, emailed: false as const };
    }

    const { enqueueProfessionalReadinessKit } = await import("@/lib/marketing-leads.server");
    const emailed = await enqueueProfessionalReadinessKit({
      id: row.id,
      name: data.name,
      email: data.email.toLowerCase(),
      persona: data.persona,
    });

    return { ok: true as const, emailed };
  });
