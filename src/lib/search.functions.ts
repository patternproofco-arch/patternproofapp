import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchHit = {
  id: string;
  kind: "incident" | "evidence" | "voice_note" | "court_date" | "communication";
  title: string;
  snippet: string;
  date: string | null;
  to: string;
};

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.q;
    const like = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
    const uid = context.userId;
    const sb = context.supabase;

    const [inc, ev, vn, cd] = await Promise.all([
      sb.from("incidents")
        .select("id, date, description, location, witnesses, emotional_impact")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .or(`description.ilike.${like},location.ilike.${like},witnesses.ilike.${like},emotional_impact.ilike.${like}`)
        .order("date", { ascending: false })
        .limit(20),
      sb.from("evidence")
        .select("id, title, date, description, file_type")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .or(`title.ilike.${like},description.ilike.${like}`)
        .order("date", { ascending: false })
        .limit(20),
      sb.from("voice_notes")
        .select("id, title, date")
        .eq("user_id", uid)
        .ilike("title", like)
        .order("date", { ascending: false })
        .limit(20),
      sb.from("court_dates")
        .select("id, court_name, hearing_type, hearing_at, location, notes")
        .eq("user_id", uid)
        .or(`court_name.ilike.${like},hearing_type.ilike.${like},location.ilike.${like},notes.ilike.${like}`)
        .order("hearing_at", { ascending: false })
        .limit(20),
    ]);

    const hits: SearchHit[] = [];
    for (const r of (inc.data ?? []) as Array<{ id: string; date: string; description: string; location: string | null }>) {
      hits.push({
        id: r.id, kind: "incident", to: "/timeline",
        title: `Incident — ${r.date}`,
        snippet: (r.description ?? "").slice(0, 180),
        date: r.date,
      });
    }
    for (const r of (ev.data ?? []) as Array<{ id: string; title: string; date: string; description: string | null; file_type: string }>) {
      hits.push({
        id: r.id, kind: "evidence", to: "/evidence",
        title: r.title,
        snippet: r.description ?? `${r.file_type} file`,
        date: r.date,
      });
    }
    for (const r of (vn.data ?? []) as Array<{ id: string; title: string; date: string }>) {
      hits.push({
        id: r.id, kind: "voice_note", to: "/voice-notes",
        title: r.title, snippet: "", date: r.date,
      });
    }
    for (const r of (cd.data ?? []) as Array<{ id: string; court_name: string; hearing_type: string; hearing_at: string; location: string | null; notes: string | null }>) {
      hits.push({
        id: r.id, kind: "court_date", to: "/court-dates",
        title: `${r.hearing_type} — ${r.court_name}`,
        snippet: [r.location, r.notes].filter(Boolean).join(" · "),
        date: r.hearing_at,
      });
    }
    return { hits, q };
  });