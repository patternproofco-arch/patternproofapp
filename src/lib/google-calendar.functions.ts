import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export const syncCourtDateToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      summary: z.string().min(1).max(200),
      description: z.string().max(2000).optional().nullable(),
      location: z.string().max(200).optional().nullable(),
      startISO: z.string().min(1),
      durationMinutes: z.number().int().min(15).max(480).default(60),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_CALENDAR_API_KEY;
    if (!lovableKey || !connKey) {
      return { ok: false as const, reason: "not-connected" };
    }
    const start = new Date(data.startISO);
    const end = new Date(start.getTime() + data.durationMinutes * 60_000);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const body = {
      summary: data.summary,
      description: data.description ?? undefined,
      location: data.location ?? undefined,
      start: { dateTime: start.toISOString(), timeZone: tz },
      end: { dateTime: end.toISOString(), timeZone: tz },
      reminders: { useDefault: false, overrides: [
        { method: "popup", minutes: 24 * 60 },
        { method: "popup", minutes: 60 },
      ] },
    };
    const res = await fetch(`${GATEWAY}/calendars/primary/events`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false as const, reason: `gateway-${res.status}`, detail: text.slice(0, 300) };
    }
    const event = await res.json() as { id?: string; htmlLink?: string };
    return { ok: true as const, eventId: event.id ?? null, htmlLink: event.htmlLink ?? null };
  });