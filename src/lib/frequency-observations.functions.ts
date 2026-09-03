import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  abuseTypeLabel,
  buildObservation,
  dateLabel,
  daysAgoDate,
  daysAgoIso,
  monthStartDate,
  quarterStartDate,
  type FrequencyObservation,
  type ObservationSourceRow,
} from "@/lib/frequency-observations.server";

export type { FrequencyObservation } from "@/lib/frequency-observations.server";

/**
 * Deterministic SQL counts over the survivor's own records. No AI is involved
 * and no interpretation is generated — see frequency-observations.server.ts.
 */
export const getFrequencyObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const out: FrequencyObservation[] = [];

    const last30 = daysAgoDate(30);
    const last14 = daysAgoDate(14);
    const last14Iso = daysAgoIso(14);

    // Incidents in the last 30 days, grouped by the categories she chose.
    const inc = await supabase
      .from("incidents")
      .select("id, date, abuse_types")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("date", last30)
      .order("date", { ascending: false });

    const byType = new Map<string, ObservationSourceRow[]>();
    for (const row of inc.data ?? []) {
      for (const t of (row.abuse_types ?? []) as string[]) {
        const list = byType.get(t) ?? [];
        list.push({ id: row.id as string, label: dateLabel(row.date as string | null) });
        byType.set(t, list);
      }
    }
    for (const [type, rows] of byType) {
      const o = buildObservation(
        `incidents:${type}`,
        "incidents",
        `Marks logged under ${abuseTypeLabel(type)}`,
        "in the past 30 days",
        rows,
      );
      if (o) out.push(o);
    }

    // Communications she flagged herself.
    const comms = await supabase
      .from("communications")
      .select("id, date")
      .eq("user_id", userId)
      .eq("harassment_flag", true)
      .gte("date", last14)
      .order("date", { ascending: false });
    const commsObs = buildObservation(
      "communications:flagged",
      "communications",
      "logged messages you flagged",
      "in the past 14 days",
      (comms.data ?? []).map((r) => ({
        id: r.id as string,
        label: dateLabel(r.date as string | null),
      })),
    );
    if (commsObs) out.push(commsObs);

    // Imported thread messages carrying any marker flag.
    const tm = await supabase
      .from("thread_messages")
      .select("id, sent_on, flags, created_at")
      .eq("user_id", userId)
      .gte("created_at", last14Iso)
      .order("created_at", { ascending: false })
      .limit(500);
    const flagged = (tm.data ?? []).filter((r) => {
      const f = r.flags as Record<string, unknown> | null;
      return !!f && Object.keys(f).length > 0;
    });
    const tmObs = buildObservation(
      "thread_messages:flagged",
      "thread_messages",
      "imported messages carrying a marker",
      "in the past 14 days",
      flagged.map((r) => ({
        id: r.id as string,
        label: dateLabel((r.sent_on as string | null) ?? (r.created_at as string)),
      })),
    );
    if (tmObs) out.push(tmObs);

    // Court dates recorded this quarter.
    const cd = await supabase
      .from("court_dates")
      .select("id, hearing_at")
      .eq("user_id", userId)
      .gte("hearing_at", quarterStartDate())
      .order("hearing_at", { ascending: false });
    const cdObs = buildObservation(
      "court_dates:quarter",
      "court_dates",
      "court dates recorded",
      "this quarter",
      (cd.data ?? []).map((r) => ({
        id: r.id as string,
        label: dateLabel(r.hearing_at as string | null),
      })),
    );
    if (cdObs) out.push(cdObs);

    // Files added this month.
    const ev = await supabase
      .from("evidence")
      .select("id, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("created_at", monthStartDate())
      .order("created_at", { ascending: false });
    const evObs = buildObservation(
      "evidence:month",
      "evidence",
      "files added",
      "this month",
      (ev.data ?? []).map((r) => ({
        id: r.id as string,
        label: dateLabel(r.created_at as string),
      })),
    );
    if (evObs) out.push(evObs);

    out.sort((a, b) => b.count - a.count);
    return { observations: out };
  });
