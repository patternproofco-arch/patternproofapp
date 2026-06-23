import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSupabaseStorageUrl } from "./safe-fetch.server";

type SourceType = "pdf" | "csv" | "excel" | "txt" | "rsmf" | "zip";

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
      .select("id,user_id,source_type")
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