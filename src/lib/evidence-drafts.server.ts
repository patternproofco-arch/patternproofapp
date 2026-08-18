import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiUsage } from "./ai-usage.server";

// -----------------------------------------------------------------------------
// Turn an uploaded photo, audio note, or video into a *draft* incident record.
// The draft is never written to `incidents` — it waits in
// `evidence_incident_drafts` until the survivor reads it and accepts it. The
// AI describes only what is visible or audible; it does not interpret intent,
// diagnose, or label anything as abuse.
// -----------------------------------------------------------------------------

const DRAFT_MODEL = "google/gemini-2.5-pro";
const TRANSCRIBE_MODEL = "openai/gpt-4o-transcribe";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const DRAFT_SYSTEM_PROMPT = `You are drafting an incident record for a survivor to review and edit in a documentation app. Return JSON only, no preamble, no markdown.

Schema (use null when unsure):
{
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM (24h) or null",
  "location": "string or null",
  "description": "string — a calm, factual first-person account of what is visible or audible. 1-5 sentences, plain language.",
  "abuse_types": ["physical"|"emotional"|"financial"|"coercive"|"custody"|"surveillance"|"location_tracking"|"account_control"|"smart_home"|"impersonation"|"digital_intimidation"|"other"],
  "witnesses": "string or null",
  "emotional_impact": "string or null",
  "uncertain": ["short strings naming anything you could not read or hear clearly"]
}

Rules:
- Describe only what the file actually shows or says. Never infer motive, intent, or state of mind.
- Never diagnose, never characterise anyone, never conclude that abuse occurred. That judgement belongs to the person, not to you.
- Only fill date/time/location if they appear in the file (a printed timestamp, a spoken date, a visible place name). Otherwise null.
- abuse_types should reflect only categories clearly evidenced by the content. An empty array is a valid, honest answer.
- Put anything unclear into "uncertain" rather than guessing.`;

export interface IncidentDraft {
  date: string | null;
  time: string | null;
  location: string | null;
  description: string;
  abuse_types: string[];
  witnesses: string | null;
  emotional_impact: string | null;
  uncertain: string[];
}

type AnyClient = SupabaseClient;

function parseDraft(raw: string): IncidentDraft | null {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const p = JSON.parse(cleaned) as Partial<IncidentDraft>;
    if (typeof p.description !== "string" || !p.description.trim()) return null;
    return {
      date: typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : null,
      time: typeof p.time === "string" && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null,
      location: typeof p.location === "string" ? p.location.slice(0, 300) : null,
      description: p.description.trim().slice(0, 4000),
      abuse_types: Array.isArray(p.abuse_types) ? p.abuse_types.filter((t) => typeof t === "string").slice(0, 8) : [],
      witnesses: typeof p.witnesses === "string" ? p.witnesses.slice(0, 300) : null,
      emotional_impact: typeof p.emotional_impact === "string" ? p.emotional_impact.slice(0, 1000) : null,
      uncertain: Array.isArray(p.uncertain) ? p.uncertain.filter((t) => typeof t === "string").slice(0, 10) : [],
    };
  } catch {
    return null;
  }
}

async function inlineFile(
  supabase: AnyClient,
  path: string,
  mime: string,
  maxBytes = 8 * 1024 * 1024,
): Promise<string | null> {
  const dl = await supabase.storage.from("evidence-files").download(path);
  if (dl.error || !dl.data) return null;
  const buf = Buffer.from(await dl.data.arrayBuffer());
  if (buf.length > maxBytes) return null;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function transcribeFile(
  supabase: AnyClient,
  key: string,
  path: string,
  filename: string,
): Promise<{ text: string; httpStatus: number | null }> {
  const dl = await supabase.storage.from("evidence-files").download(path);
  if (dl.error || !dl.data) return { text: "", httpStatus: null };
  const form = new FormData();
  form.append("file", dl.data, filename);
  form.append("model", TRANSCRIBE_MODEL);
  form.append("response_format", "json");
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) return { text: "", httpStatus: res.status };
  const j = (await res.json()) as { text?: string };
  return { text: (j.text ?? "").trim(), httpStatus: res.status };
}

export interface DraftResult {
  ok: boolean;
  reason?: string;
  draftId?: string;
  draft?: IncidentDraft;
  transcriptExcerpt?: string | null;
  frameCount?: number;
}

/**
 * @param framePaths storage paths for still frames the client sampled from a
 * video. Ignored for image/audio evidence.
 */
export async function buildDraftFromEvidence(
  supabase: AnyClient,
  userId: string,
  evidenceId: string,
  framePaths: string[],
): Promise<DraftResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, reason: "unavailable" };

  const rowRes = await supabase
    .from("evidence")
    .select("id, file_url, mime, file_type, original_filename, title, is_sealed")
    .eq("id", evidenceId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (rowRes.error || !rowRes.data) return { ok: false, reason: "not_found" };
  const row = rowRes.data as {
    id: string; file_url: string; mime: string | null; file_type: string | null;
    original_filename: string | null; title: string | null; is_sealed: boolean | null;
  };
  // Sealed records are never sent to any AI service.
  if (row.is_sealed) return { ok: false, reason: "sealed" };

  const mime = row.mime ?? row.file_type ?? "";
  const kind = mime.startsWith("image/") ? "image"
    : mime.startsWith("audio/") ? "audio"
    : mime.startsWith("video/") ? "video"
    : null;
  if (!kind) return { ok: false, reason: "unsupported" };

  const started = Date.now();
  const content: Array<Record<string, unknown>> = [];
  let transcript = "";
  let frames = 0;

  if (kind === "image") {
    const uri = await inlineFile(supabase, row.file_url, mime);
    if (!uri) return { ok: false, reason: "too_large" };
    content.push({ type: "text", text: "Draft an incident record from this image." });
    content.push({ type: "image_url", image_url: { url: uri } });
  } else {
    const name = row.original_filename ?? (kind === "video" ? "clip.mp4" : "clip.wav");
    const t = await transcribeFile(supabase, key, row.file_url, name);
    transcript = t.text;
    if (kind === "video") {
      for (const p of framePaths.slice(0, 6)) {
        const uri = await inlineFile(supabase, p, "image/jpeg", 4 * 1024 * 1024);
        if (uri) { content.push({ type: "image_url", image_url: { url: uri } }); frames += 1; }
      }
    }
    if (!transcript && frames === 0) {
      await logAiUsage(supabase, userId, {
        feature: "evidence_draft", model: TRANSCRIBE_MODEL, fileType: mime,
        evidenceId, status: "empty", httpStatus: t.httpStatus, durationMs: Date.now() - started,
      });
      return { ok: false, reason: "nothing_readable" };
    }
    content.unshift({
      type: "text",
      text: transcript
        ? `Draft an incident record from this ${kind}. Transcript of what was said (AI-generated, may contain errors):\n\n${transcript.slice(0, 12000)}`
        : `Draft an incident record from these still frames taken from a ${kind}.`,
    });
  }

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: DRAFT_MODEL,
      messages: [
        { role: "system", content: DRAFT_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    await logAiUsage(supabase, userId, {
      feature: "evidence_draft", model: DRAFT_MODEL, fileType: mime, evidenceId,
      status: "failed", httpStatus: res.status, durationMs: Date.now() - started,
      meta: { kind, frames },
    });
    return { ok: false, reason: res.status === 429 ? "busy" : "failed" };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const draft = parseDraft(json.choices?.[0]?.message?.content ?? "");
  await logAiUsage(supabase, userId, {
    feature: "evidence_draft", model: DRAFT_MODEL, fileType: mime, evidenceId,
    status: draft ? "ok" : "empty", httpStatus: res.status, durationMs: Date.now() - started,
    usage: json.usage ?? null, meta: { kind, frames, had_transcript: transcript.length > 0 },
  });
  if (!draft) return { ok: false, reason: "unreadable" };

  const excerpt = transcript ? transcript.slice(0, 2000) : null;
  const up = await supabase
    .from("evidence_incident_drafts")
    .upsert({
      user_id: userId,
      evidence_id: evidenceId,
      source: kind,
      draft,
      transcript_excerpt: excerpt,
      frame_count: frames,
      model: DRAFT_MODEL,
      status: "pending",
      created_incident_id: null,
    }, { onConflict: "evidence_id" })
    .select("id")
    .single();
  if (up.error || !up.data) return { ok: false, reason: "save_failed" };

  return { ok: true, draftId: (up.data as { id: string }).id, draft, transcriptExcerpt: excerpt, frameCount: frames };
}