import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSupabaseStorageUrl } from "./safe-fetch.server";
import { createHash } from "crypto";

type SourceType = "pdf" | "csv" | "excel" | "txt" | "rsmf" | "zip";
type CaptureMethod = "multi_screenshot" | "backup_export" | "screen_recording" | "call_log_photos";

interface ParsedMessage {
  position: number;
  sender: string | null;
  recipient: string | null;
  sent_on: string | null; // YYYY-MM-DD
  sent_at_time: string | null; // HH:MM:SS
  body: string | null;
  attachment_name: string | null;
}

// ---------- CSV ----------
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function pickHeader(headers: string[], names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const n of names) {
    const i = lower.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

function normalizeDate(input: string | null | undefined): { date: string | null; time: string | null } {
  if (!input) return { date: null, time: null };
  const s = input.trim();
  if (!s) return { date: null, time: null };
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 19);
    // Heuristic: if parsing produced midnight UTC and the input had no time, drop time
    const hadTime = /\d{1,2}:\d{2}/.test(s);
    return { date, time: hadTime ? time : null };
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null };
  return { date: null, time: null };
}

function parseCsv(text: string): ParsedMessage[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const senderIdx = pickHeader(headers, ["sender", "from", "author"]);
  const recipientIdx = pickHeader(headers, ["recipient", "to", "receiver"]);
  const dateIdx = pickHeader(headers, ["date", "datetime", "timestamp", "sent", "time"]);
  const bodyIdx = pickHeader(headers, ["message", "body", "text", "content"]);
  const attachIdx = pickHeader(headers, ["attachment", "attachments", "media"]);
  const out: ParsedMessage[] = [];
  for (let i = 1; i < lines.length && out.length < 5000; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 1 && cols[0] === "") continue;
    const { date, time } = normalizeDate(dateIdx >= 0 ? cols[dateIdx] : null);
    out.push({
      position: i,
      sender: senderIdx >= 0 ? cols[senderIdx] || null : null,
      recipient: recipientIdx >= 0 ? cols[recipientIdx] || null : null,
      sent_on: date,
      sent_at_time: time,
      body: bodyIdx >= 0 ? cols[bodyIdx] || null : cols.join(" ") || null,
      attachment_name: attachIdx >= 0 ? cols[attachIdx] || null : null,
    });
  }
  return out;
}

// ---------- TXT ----------
// Heuristic for common iMessage/SMS exports:
// [2024-05-12, 9:14 PM] John Doe: Hey ...
// 2024-05-12 21:14 - John: Hey
function parseTxt(text: string): ParsedMessage[] {
  const lines = text.split(/\r?\n/);
  const re = /^[\[(]?\s*(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})[, ]+(\d{1,2}:\d{2}(?:\s?[APap][Mm])?)\s*[\])]?\s*[-–:]?\s*([^:]{1,80}?):\s*(.*)$/;
  const out: ParsedMessage[] = [];
  let pos = 0;
  let current: ParsedMessage | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\u200e/g, "").trimEnd();
    if (!line.trim()) continue;
    const m = line.match(re);
    if (m) {
      if (current) out.push(current);
      const { date, time } = normalizeDate(`${m[1]} ${m[2]}`);
      pos += 1;
      current = {
        position: pos,
        sender: m[3].trim() || null,
        recipient: null,
        sent_on: date,
        sent_at_time: time,
        body: m[4].trim() || null,
        attachment_name: null,
      };
    } else if (current) {
      current.body = (current.body ? current.body + "\n" : "") + line.trim();
    }
    if (out.length >= 5000) break;
  }
  if (current && out.length < 5000) out.push(current);
  return out;
}

// ---------- AI flagging ----------
const FLAG_SYSTEM = `You are a domestic-violence documentation assistant analyzing a conversation export. Read the messages and return STRICT JSON only — no markdown, no preamble.

Schema:
{
  "summary": "2-4 sentence plain-language summary for the survivor.",
  "attorney_summary": "3-6 sentence neutral, fact-based summary for an attorney. No legal conclusions.",
  "flags": [
    { "type": "threat" | "harassment" | "escalation" | "custody_interference" | "coercive_control" | "financial_abuse" | "pattern", "label": "short label", "evidence": "short quote or paraphrase", "severity": "low" | "medium" | "high" }
  ],
  "exhibit_label": "Exhibit A — short descriptive label"
}

Be conservative. If nothing concerning is present, return flags: []. Never invent quotes.`;

async function runAiAnalysis(messages: ParsedMessage[]): Promise<{
  summary: string | null;
  attorney_summary: string | null;
  flags: Array<{ type: string; label: string; evidence: string; severity: string }>;
  exhibit_label: string | null;
} | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || messages.length === 0) return null;
  const sample = messages.slice(0, 200).map((m, i) => {
    const when = [m.sent_on, m.sent_at_time].filter(Boolean).join(" ");
    return `${i + 1}. [${when || "?"}] ${m.sender || "?"}: ${(m.body || "").slice(0, 600)}`;
  }).join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: FLAG_SYSTEM },
          { role: "user", content: `Conversation export (${messages.length} messages, showing up to 200):\n\n${sample}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = j.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as {
      summary?: string;
      attorney_summary?: string;
      flags?: Array<{ type: string; label: string; evidence: string; severity: string }>;
      exhibit_label?: string;
    };
    return {
      summary: parsed.summary ?? null,
      attorney_summary: parsed.attorney_summary ?? null,
      flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 30) : [],
      exhibit_label: parsed.exhibit_label ?? null,
    };
  } catch {
    return null;
  }
}

// ---------- Server functions ----------
export const parseMessageThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      threadId: z.string().uuid(),
      signedUrl: z.string().url().max(2000),
      sourceType: z.enum(["pdf", "csv", "excel", "txt", "rsmf", "zip"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirm ownership
    const { data: thread, error: threadErr } = await supabase
      .from("message_threads")
      .select("id,user_id,source_type,capture_method")
      .eq("id", data.threadId)
      .single();
    if (threadErr || !thread || thread.user_id !== userId) {
      throw new Error("Thread not found");
    }

    const sourceType = data.sourceType as SourceType;
    let parsed: ParsedMessage[] = [];
    let status: "parsed" | "partial" | "queued" | "failed" = "parsed";
    let parseError: string | null = null;

    try {
      assertSupabaseStorageUrl(data.signedUrl);
      const fileRes = await fetch(data.signedUrl);
      if (!fileRes.ok) throw new Error("download-failed");
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (buf.length > 20 * 1024 * 1024) throw new Error("file too large (20MB max)");

      if (sourceType === "csv") {
        parsed = parseCsv(buf.toString("utf-8"));
      } else if (sourceType === "txt") {
        parsed = parseTxt(buf.toString("utf-8"));
      } else {
        // PDF / Excel / RSMF / ZIP: deep parsing is queued. File is safely stored.
        status = "queued";
        parseError = "This export format is stored securely. Structured parsing for this file type is in active development — your conversation will be available in your timeline shortly.";
      }
    } catch (e) {
      status = "failed";
      parseError = e instanceof Error ? e.message : "unknown error";
    }

    if (parsed.length === 0 && status === "parsed") {
      status = "partial";
      parseError = parseError ?? "No messages could be detected in this file. You can still link it as evidence.";
    }

    // Insert parsed messages
    if (parsed.length > 0) {
      const rows = parsed.map((m) => ({
        thread_id: data.threadId,
        user_id: userId,
        position: m.position,
        sender: m.sender,
        recipient: m.recipient,
        sent_on: m.sent_on,
        sent_at_time: m.sent_at_time,
        body: m.body,
        attachment_name: m.attachment_name,
        attachment_url: null,
        flags: [],
      }));
      // Insert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const slice = rows.slice(i, i + 500);
        const { error: insErr } = await supabase.from("thread_messages").insert(slice);
        if (insErr) { status = "partial"; parseError = insErr.message; break; }
      }
    }

    // AI analysis (best-effort)
    const ai = parsed.length > 0 ? await runAiAnalysis(parsed) : null;

    const update = {
      parse_status: status,
      parse_error: parseError,
      message_count: parsed.length,
      summary: ai?.summary ?? null,
      attorney_summary: ai?.attorney_summary ?? null,
      flags: ai?.flags ?? [],
      exhibit_label: ai?.exhibit_label ?? null,
    };
    const { error: updErr } = await supabase
      .from("message_threads")
      .update(update)
      .eq("id", data.threadId);
    if (updErr) throw new Error(updErr.message);

    // Cross-tier audit trail — records which capture method was used.
    await supabase.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: "thread.imported",
      p_subject_kind: "message_thread",
      p_subject_id: data.threadId,
      p_actor_kind: "user",
      p_actor_id: userId,
      p_meta: {
        capture_method: (thread as { capture_method?: string }).capture_method ?? "backup_export",
        source_type: sourceType,
        message_count: parsed.length,
        status,
      },
    });

    return {
      ok: true as const,
      status,
      parseError,
      messageCount: parsed.length,
      summary: update.summary,
      attorneySummary: update.attorney_summary,
      flags: update.flags,
      exhibitLabel: update.exhibit_label,
    };
  });

// -----------------------------------------------------------------------------
// Tier 1 — Multi-screenshot stitch. Uploaded screenshot storage paths come from
// the client (which uploaded via the standard supabase-js client). We fetch
// each via signed URL, run a vision extract per image, and dedup consecutive
// overlaps by text similarity. Screenshots remain the primary artifact; the
// parsed text is a searchable index labeled AI-extracted — unverified.
// -----------------------------------------------------------------------------

interface StitchBubble { sender: string | null; timestamp: string | null; text: string; }

const STITCH_SYSTEM = `You are reading a screenshot of a text/chat conversation. Return STRICT JSON only.
Schema: { "bubbles": [ { "sender": "string or null", "timestamp": "string or null (as it appears)", "text": "string" } ] }
Order bubbles top-to-bottom as they appear. Never invent content. If a value is unclear, use null.`;

async function extractBubblesFromImage(signedUrl: string, mimeType: string, key: string): Promise<StitchBubble[]> {
  try {
    assertSupabaseStorageUrl(signedUrl);
    const r = await fetch(signedUrl);
    if (!r.ok) return [];
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return [];
    const dataUri = `data:${mimeType};base64,${buf.toString("base64")}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: STITCH_SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Extract every visible message bubble from this screenshot." },
            { type: "image_url", image_url: { url: dataUri } },
          ] },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = j.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { bubbles?: StitchBubble[] };
    return Array.isArray(parsed.bubbles) ? parsed.bubbles.filter((b) => b && typeof b.text === "string") : [];
  } catch {
    return [];
  }
}

function normText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

function bubbleOverlap(a: StitchBubble, b: StitchBubble): number {
  const na = normText(a.text);
  const nb = normText(b.text);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (longer.includes(shorter) && shorter.length >= 8) return 0.9;
  // token Jaccard
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter += 1; });
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Deduplicate: for each screenshot after the first, drop its leading bubbles
// that match the trailing bubbles of the previous screenshot (>=0.7 overlap).
function dedupAcrossScreenshots(perImage: StitchBubble[][]): StitchBubble[] {
  if (perImage.length === 0) return [];
  const merged: StitchBubble[] = [...perImage[0]!];
  for (let i = 1; i < perImage.length; i++) {
    const next = perImage[i]!;
    if (next.length === 0) continue;
    const tail = merged.slice(-Math.min(8, merged.length));
    // find the longest prefix of `next` whose bubbles match somewhere in tail
    let skipCount = 0;
    for (let k = 0; k < Math.min(next.length, tail.length); k++) {
      const candidate = next[k]!;
      const matched = tail.some((t) => bubbleOverlap(t, candidate) >= 0.7);
      if (matched) skipCount = k + 1;
      else if (skipCount > 0) break;
    }
    for (let k = skipCount; k < next.length; k++) merged.push(next[k]!);
  }
  return merged;
}

export const stitchScreenshotThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    screenshotPaths: z.array(z.string().min(1)).min(1).max(60),
    capturedAt: z.string().datetime().optional(),
    captureNotes: z.string().max(500).optional(),
    participantHint: z.string().max(200).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not available right now.");

    // Insert thread row first
    const { data: inserted, error: insErr } = await supabase
      .from("message_threads")
      .insert({
        user_id: userId,
        source_type: "txt",
        source_filename: `Screenshot capture · ${new Date().toLocaleString()}`,
        file_url: data.screenshotPaths[0]!,
        parse_status: "pending",
        capture_method: "multi_screenshot" as CaptureMethod,
        captured_at: data.capturedAt ?? new Date().toISOString(),
        capture_notes: data.captureNotes ?? null,
        primary_artifact_urls: data.screenshotPaths,
        screenshot_count: data.screenshotPaths.length,
        conversation_participant: data.participantHint ?? null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Could not create thread record.");
    const threadId = inserted.id;

    // Sign each screenshot and extract bubbles
    const perImage: StitchBubble[][] = [];
    const shaList: string[] = [];
    for (const path of data.screenshotPaths) {
      const { data: signed } = await supabase.storage.from("evidence-files").createSignedUrl(path, 600);
      if (!signed?.signedUrl) { perImage.push([]); continue; }
      // hash the file for the audit meta
      try {
        const r = await fetch(signed.signedUrl);
        const buf = Buffer.from(await r.arrayBuffer());
        shaList.push(createHash("sha256").update(buf).digest("hex"));
      } catch { /* ignore */ }
      const mime = /\.png$/i.test(path) ? "image/png" : /\.webp$/i.test(path) ? "image/webp" : "image/jpeg";
      const bubbles = await extractBubblesFromImage(signed.signedUrl, mime, key);
      perImage.push(bubbles);
    }

    const merged = dedupAcrossScreenshots(perImage);
    let status: "parsed" | "partial" = merged.length > 0 ? "parsed" : "partial";
    let parseError: string | null = merged.length === 0
      ? "We couldn't read any messages from these screenshots. Your original images are safely stored — you can still work with them as evidence."
      : null;

    if (merged.length > 0) {
      const rows = merged.map((b, i) => ({
        thread_id: threadId,
        user_id: userId,
        position: i + 1,
        sender: b.sender ?? null,
        recipient: null,
        sent_on: null,
        sent_at_time: null,
        body: b.text ?? null,
        attachment_name: null,
        attachment_url: null,
        flags: { ai_extracted: true, unverified: true, timestamp_hint: b.timestamp ?? null },
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("thread_messages").insert(rows.slice(i, i + 500));
        if (error) { status = "partial"; parseError = error.message; break; }
      }
    }

    // Best-effort AI summary/flags — reuse the same conversation-analysis pipeline
    const asParsed = merged.map((b, i) => ({
      position: i + 1, sender: b.sender ?? null, recipient: null,
      sent_on: null, sent_at_time: null, body: b.text, attachment_name: null,
    }));
    const ai = asParsed.length > 0 ? await runAiAnalysis(asParsed) : null;

    await supabase
      .from("message_threads")
      .update({
        parse_status: status,
        parse_error: parseError,
        message_count: merged.length,
        summary: ai?.summary ?? null,
        attorney_summary: ai?.attorney_summary ?? null,
        flags: ai?.flags ?? [],
        exhibit_label: ai?.exhibit_label ?? null,
      })
      .eq("id", threadId);

    await supabase.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: "thread.imported",
      p_subject_kind: "message_thread",
      p_subject_id: threadId,
      p_actor_kind: "user",
      p_actor_id: userId,
      p_meta: {
        capture_method: "multi_screenshot",
        captured_at: data.capturedAt ?? new Date().toISOString(),
        artifact_count: data.screenshotPaths.length,
        sha256_list: shaList,
      },
    });

    return { ok: true as const, threadId, messageCount: merged.length, status };
  });

// -----------------------------------------------------------------------------
// Tier 3 — Screen recording. The video file itself is the primary evidence
// artifact (hashed and stored). Transcription runs best-effort and is stored
// on the thread summary explicitly labeled AI-generated — unverified.
// -----------------------------------------------------------------------------

export const ingestRecordedThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    videoPath: z.string().min(1),
    filename: z.string().max(300),
    durationSec: z.number().int().nonnegative().optional(),
    capturedAt: z.string().datetime().optional(),
    captureNotes: z.string().max(500).optional(),
    participantHint: z.string().max(200).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // hash the video for audit
    let sha: string | null = null;
    try {
      const { data: signed } = await supabase.storage.from("evidence-files").createSignedUrl(data.videoPath, 600);
      if (signed?.signedUrl) {
        const r = await fetch(signed.signedUrl);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length <= 200 * 1024 * 1024) {
          sha = createHash("sha256").update(buf).digest("hex");
        }
      }
    } catch { /* ignore */ }

    const { data: inserted, error: insErr } = await supabase
      .from("message_threads")
      .insert({
        user_id: userId,
        source_type: "zip", // reuse existing enum-ish column; not used for parsing
        source_filename: data.filename,
        file_url: data.videoPath,
        parse_status: "queued",
        parse_error: "This is a screen recording — the video itself is your primary evidence. A searchable AI transcript is being generated separately and is labeled unverified until you review it.",
        capture_method: "screen_recording" as CaptureMethod,
        captured_at: data.capturedAt ?? new Date().toISOString(),
        capture_notes: data.captureNotes ?? null,
        primary_artifact_urls: [data.videoPath],
        video_duration_sec: data.durationSec ?? null,
        conversation_participant: data.participantHint ?? null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Could not create thread record.");

    await supabase.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: "thread.imported",
      p_subject_kind: "message_thread",
      p_subject_id: inserted.id,
      p_actor_kind: "user",
      p_actor_id: userId,
      p_meta: {
        capture_method: "screen_recording",
        captured_at: data.capturedAt ?? new Date().toISOString(),
        artifact_count: 1,
        sha256_list: sha ? [sha] : [],
        video_duration_sec: data.durationSec ?? null,
      },
    });

    return { ok: true as const, threadId: inserted.id };
  });

// -----------------------------------------------------------------------------
// Tier 3 transcription. We deliberately do NOT create a linked evidence row —
// the recording lives under message_threads (its own surface with capture
// method, participant hint, primary_artifact_urls). Fabricating an evidence
// row just to reuse transcribeEvidence would leak the video into the Evidence
// tabs, require SHA/EXIF plumbing, and couple two features that render very
// differently. Instead we call the same Lovable AI transcription endpoint
// directly and store the transcript on the thread's `summary` field, which
// is already labeled "AI-generated — unverified" by the message-thread UI.
// -----------------------------------------------------------------------------

export const transcribeRecordedThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;

    const rowRes = await supabase
      .from("message_threads")
      .select("id, file_url, source_filename, capture_method")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (rowRes.error || !rowRes.data) throw new Error("Thread not found");
    const row = rowRes.data as { id: string; file_url: string; source_filename: string | null; capture_method: string | null };
    if (row.capture_method !== "screen_recording") {
      throw new Error("Only screen recordings are transcribed here.");
    }

    await supabase
      .from("message_threads")
      .update({ parse_status: "pending" })
      .eq("id", row.id)
      .eq("user_id", userId);

    const failFriendly = async (msg: string) => {
      await supabase
        .from("message_threads")
        .update({
          parse_status: "failed",
          parse_error: msg,
        })
        .eq("id", row.id)
        .eq("user_id", userId);
    };

    if (!key) {
      await failFriendly("Couldn't generate a transcript automatically. The video is still saved as your evidence.");
      return { ok: false as const, reason: "no_key" as const };
    }

    try {
      const dl = await supabase.storage.from("evidence-files").download(row.file_url);
      if (dl.error || !dl.data) {
        await failFriendly("Couldn't generate a transcript automatically. The video is still saved as your evidence.");
        return { ok: false as const, reason: "download_failed" as const };
      }
      const form = new FormData();
      form.append("file", dl.data, row.source_filename ?? "recording.mp4");
      form.append("model", "openai/gpt-4o-transcribe");
      form.append("response_format", "verbose_json");

      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (!res.ok) {
        await failFriendly("Couldn't generate a transcript automatically. The video is still saved as your evidence.");
        return { ok: false as const, reason: "api_failed" as const, status: res.status };
      }
      const json = (await res.json()) as { text?: string; segments?: Array<{ text?: string }> };
      const text = (json.text ?? (json.segments ?? []).map((s) => s.text ?? "").join(" ")).trim();
      if (!text) {
        await failFriendly("Couldn't generate a transcript automatically. The video is still saved as your evidence.");
        return { ok: false as const, reason: "empty" as const };
      }

      await supabase
        .from("message_threads")
        .update({
          summary: text,
          parse_status: "parsed",
          parse_error: null,
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      return { ok: true as const, length: text.length };
    } catch {
      await failFriendly("Couldn't generate a transcript automatically. The video is still saved as your evidence.");
      return { ok: false as const, reason: "exception" as const };
    }
  });

// -----------------------------------------------------------------------------
// Call-log photo import (iPhone + Android — same photo/OCR path).
// A call log is not a message thread, but survivors need it in the same
// conversation-history surface. We ingest photos of the phone's Recents/Calls
// screen, run vision extraction to pull each call row, and store them as
// thread_messages with body = "[Call: incoming · 4 min]" so they render in the
// same timeline. Photos remain the primary evidence artifact.
// -----------------------------------------------------------------------------

interface CallRow {
  callerLabel: string | null; // name or number as shown on screen
  direction: "incoming" | "outgoing" | "missed" | "unknown";
  timestampText: string | null; // as it appears on screen
  durationText: string | null;
}

const CALL_LOG_SYSTEM = `You are reading a screenshot of a phone's call log / Recents screen (iPhone or Android). Return STRICT JSON only.
Schema: { "calls": [ { "callerLabel": "string or null (name/number)", "direction": "incoming" | "outgoing" | "missed" | "unknown", "timestampText": "string or null (as shown)", "durationText": "string or null (as shown)" } ] }
Order top-to-bottom as shown. Missed calls typically appear in red or with an arrow icon. Never invent entries.`;

async function extractCallsFromImage(signedUrl: string, mimeType: string, key: string): Promise<CallRow[]> {
  try {
    assertSupabaseStorageUrl(signedUrl);
    const r = await fetch(signedUrl);
    if (!r.ok) return [];
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return [];
    const dataUri = `data:${mimeType};base64,${buf.toString("base64")}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: CALL_LOG_SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Extract every visible call row from this call-log screenshot." },
            { type: "image_url", image_url: { url: dataUri } },
          ] },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = j.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { calls?: CallRow[] };
    return Array.isArray(parsed.calls) ? parsed.calls.filter((c) => c && typeof c === "object") : [];
  } catch {
    return [];
  }
}

function normCall(c: CallRow): string {
  return `${(c.callerLabel ?? "").toLowerCase().trim()}|${c.direction}|${(c.timestampText ?? "").toLowerCase().trim()}|${(c.durationText ?? "").toLowerCase().trim()}`;
}

function dedupCallRows(perImage: CallRow[][]): CallRow[] {
  const seen = new Set<string>();
  const out: CallRow[] = [];
  for (const shot of perImage) {
    for (const c of shot) {
      const k = normCall(c);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

function renderCallBody(c: CallRow): string {
  const dir = c.direction === "missed" ? "Missed call"
    : c.direction === "incoming" ? "Incoming call"
    : c.direction === "outgoing" ? "Outgoing call"
    : "Call";
  const bits = [dir];
  if (c.durationText) bits.push(c.durationText);
  return `[${bits.join(" · ")}]${c.timestampText ? ` at ${c.timestampText}` : ""}`;
}

export const parseCallLogPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    photoPaths: z.array(z.string().min(1)).min(1).max(40),
    platform: z.enum(["iphone", "android", "unknown"]).default("unknown"),
    capturedAt: z.string().datetime().optional(),
    captureNotes: z.string().max(500).optional(),
    participantHint: z.string().max(200).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not available right now.");

    const { data: inserted, error: insErr } = await supabase
      .from("message_threads")
      .insert({
        user_id: userId,
        source_type: "txt",
        source_filename: `Call log · ${data.platform} · ${new Date().toLocaleString()}`,
        file_url: data.photoPaths[0]!,
        parse_status: "pending",
        capture_method: "call_log_photos" as CaptureMethod,
        captured_at: data.capturedAt ?? new Date().toISOString(),
        capture_notes: data.captureNotes ?? null,
        primary_artifact_urls: data.photoPaths,
        screenshot_count: data.photoPaths.length,
        conversation_participant: data.participantHint ?? null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Could not create thread record.");
    const threadId = inserted.id;

    const perImage: CallRow[][] = [];
    const shaList: string[] = [];
    for (const path of data.photoPaths) {
      const { data: signed } = await supabase.storage.from("evidence-files").createSignedUrl(path, 600);
      if (!signed?.signedUrl) { perImage.push([]); continue; }
      try {
        const r = await fetch(signed.signedUrl);
        const buf = Buffer.from(await r.arrayBuffer());
        shaList.push(createHash("sha256").update(buf).digest("hex"));
      } catch { /* ignore */ }
      const mime = /\.png$/i.test(path) ? "image/png" : /\.webp$/i.test(path) ? "image/webp" : "image/jpeg";
      const calls = await extractCallsFromImage(signed.signedUrl, mime, key);
      perImage.push(calls);
    }

    const merged = dedupCallRows(perImage);
    let status: "parsed" | "partial" = merged.length > 0 ? "parsed" : "partial";
    const parseError: string | null = merged.length === 0
      ? "We couldn't read any call entries from these photos. Your original images are safely stored — you can still work with them as evidence."
      : null;

    if (merged.length > 0) {
      const rows = merged.map((c, i) => ({
        thread_id: threadId,
        user_id: userId,
        position: i + 1,
        sender: c.direction === "outgoing" ? "You" : (c.callerLabel ?? null),
        recipient: c.direction === "outgoing" ? (c.callerLabel ?? null) : "You",
        sent_on: null,
        sent_at_time: null,
        body: renderCallBody(c),
        attachment_name: null,
        attachment_url: null,
        flags: {
          ai_extracted: true,
          unverified: true,
          call_row: true,
          direction: c.direction,
          timestamp_hint: c.timestampText ?? null,
          duration_hint: c.durationText ?? null,
        },
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("thread_messages").insert(rows.slice(i, i + 500));
        if (error) { status = "partial"; break; }
      }
    }

    // Lightweight summary — no AI analysis needed for call-only logs; we compute deterministic stats.
    const missed = merged.filter((c) => c.direction === "missed").length;
    const incoming = merged.filter((c) => c.direction === "incoming").length;
    const outgoing = merged.filter((c) => c.direction === "outgoing").length;
    const summary = merged.length === 0
      ? "No call entries could be read from these images."
      : `${merged.length} call${merged.length === 1 ? "" : "s"} extracted from the call log — ${incoming} incoming, ${outgoing} outgoing, ${missed} missed. AI-extracted from photos — unverified until you confirm.`;

    await supabase
      .from("message_threads")
      .update({
        parse_status: status,
        parse_error: parseError,
        message_count: merged.length,
        summary,
        attorney_summary: `Call log imported from ${data.platform} phone photos. ${merged.length} rows: ${incoming} incoming, ${outgoing} outgoing, ${missed} missed. Photo screenshots are the primary artifact; row-level extraction is AI-generated and unverified.`,
        flags: missed >= 5 ? [{ type: "pattern", label: "Repeated missed calls", evidence: `${missed} missed calls visible`, severity: "medium" }] : [],
        exhibit_label: `Call Log — ${data.platform}`,
      })
      .eq("id", threadId);

    await supabase.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: "thread.imported",
      p_subject_kind: "message_thread",
      p_subject_id: threadId,
      p_actor_kind: "user",
      p_actor_id: userId,
      p_meta: {
        capture_method: "call_log_photos",
        platform: data.platform,
        captured_at: data.capturedAt ?? new Date().toISOString(),
        artifact_count: data.photoPaths.length,
        sha256_list: shaList,
      },
    });

    return { ok: true as const, threadId, callCount: merged.length, status };
  });
