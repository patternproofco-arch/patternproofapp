import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  interest: z.enum(["survivor", "attorney", "organization", "other"]),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  sourcePath: z.string().trim().max(200).optional().or(z.literal("")),
});

export type WaitlistInput = z.infer<typeof schema>;

/**
 * Public capture endpoint for the marketing site. Writes with the service
 * role because the table is admin-read-only and has no anon grants.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      email: data.email.toLowerCase(),
      name: data.name ? data.name : null,
      interest: data.interest,
      note: data.note ? data.note : null,
      source_path: data.sourcePath ? data.sourcePath : null,
    };

    const { error } = await supabaseAdmin
      .from("waitlist_signups")
      .upsert(row, { onConflict: "email" });

    if (error && !/duplicate key|unique constraint/i.test(error.message)) {
      throw new Error("We couldn't save that just now. Try again in a moment.");
    }

    return { ok: true as const };
  });
