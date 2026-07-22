import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeName } from "@/lib/name-match";

export interface ContradictionInput {
  id: string;
  date: string | null;
  time: string | null;
  location: string | null;
  date_precision?: string | null;
  source?: string | null;
  confirmed_at?: string | null;
}

export interface ContradictionPair {
  incident_a_id: string;
  incident_b_id: string;
  date: string;
  conflict_type: "time" | "location";
  detail: string;
}

function parseTimeMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function formatTime12(t: string): string {
  const mins = parseTimeMinutes(t);
  if (mins == null) return t;
  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

/**
 * Deterministic contradiction detection. Only compares incidents that both
 * have `date_precision === 'exact'` and share an exact `date`. Excludes
 * unconfirmed AI-extracted rows (same rule used elsewhere).
 *
 * Flags a pair when:
 *  - both have a time set and they differ by more than 2 hours (>120 min), OR
 *  - both have a non-empty location and the strings differ after
 *    normalizeName() (exact mismatch — no fuzzy threshold).
 */
export function detectContradictions(rows: ContradictionInput[]): ContradictionPair[] {
  const eligible = rows.filter((r) =>
    r.date &&
    r.date_precision === "exact" &&
    !(r.source === "ai_extracted" && !r.confirmed_at),
  );
  const byDate = new Map<string, ContradictionInput[]>();
  for (const r of eligible) {
    const arr = byDate.get(r.date as string) ?? [];
    arr.push(r);
    byDate.set(r.date as string, arr);
  }
  const out: ContradictionPair[] = [];
  for (const [date, group] of byDate) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        // Time check
        if (a.time && b.time) {
          const ta = parseTimeMinutes(a.time);
          const tb = parseTimeMinutes(b.time);
          if (ta != null && tb != null && Math.abs(ta - tb) > 120) {
            out.push({
              incident_a_id: a.id,
              incident_b_id: b.id,
              date,
              conflict_type: "time",
              detail: `Logged as ${formatTime12(a.time)} and ${formatTime12(b.time)}`,
            });
          }
        }
        // Location check
        if (a.location && b.location) {
          const na = normalizeName(a.location);
          const nb = normalizeName(b.location);
          if (na && nb && na !== nb) {
            out.push({
              incident_a_id: a.id,
              incident_b_id: b.id,
              date,
              conflict_type: "location",
              detail: `Logged as "${a.location.trim()}" and "${b.location.trim()}"`,
            });
          }
        }
      }
    }
  }
  return out;
}

export const findPossibleContradictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ contradictions: ContradictionPair[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("incidents")
      .select("id,date,time,location,date_precision,source,confirmed_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("date_precision", "exact")
      .not("date", "is", null);
    if (error) return { contradictions: [] };
    return { contradictions: detectContradictions((data ?? []) as ContradictionInput[]) };
  });