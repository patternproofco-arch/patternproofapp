import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -----------------------------------------------------------------------------
// Transcribe audio/video evidence via Lovable AI Gateway. Result is stored on
// the evidence row but always treated as "AI-generated — unverified" by the
// UI until verifyTranscript is called. Speaker labels are approximate
// ("Speaker 1", "Speaker 2") — never proper names.
// -----------------------------------------------------------------------------

type Segment = {
  start: number;
  end: number;
  text: string;
  speaker: string;
};

function labelSpeakers(raw: Array<{ start: number; end: number; text: string }>): Segment[] {
  if (raw.length === 0) return [];
  const gapThresholdSec = 1.2;
  let current = 1;
  const out: Segment[] = [];
  let prevEnd = raw[0]!.end;
  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i]!;
    if (i > 0 && seg.start - prevEnd > gapThresholdSec) {
      current = current === 1 ? 2 : 1;
    }
    out.push({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      speaker: `Speaker ${current}`,
    });
    prevEnd = seg.end;
  }
  return out;
}

export const transcribeEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ evidence_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Transcription is not available right now.");

    const rowRes = await supabase
      .from("evidence")
      .select("id, file_url, mime, original_filename, transcript_status")
      .eq("id", data.evidence_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (rowRes.error || !rowRes.data) throw new Error("Evidence not found");
    const row = rowRes.data as {
      id: string;
      file_url: string;
      mime: string | null;
      original_filename: string | null;
      transcript_status: string;
    };
    const mime = row.mime ?? "";
    if (!mime.startsWith("audio/") && !mime.startsWith("video/")) {
      throw new Error("This file has no audio track to transcribe.");
    }

    await supabase
      .from("evidence")
      .update({ transcript_status: "pending" })
      .eq("id", row.id)
      .eq("user_id", userId);

    try {
      const dl = await supabase.storage.from("evidence-files").download(row.file_url);
      if (dl.error || !dl.data) throw new Error("Could not open the audio.");
      const blob = dl.data;

      const form = new FormData();
      form.append(
        "file",
        blob,
        row.original_filename ?? (mime.startsWith("video/") ? "clip.mp4" : "clip.wav"),
      );
      form.append("model", "openai/gpt-4o-transcribe");
      // Request verbose JSON so we get segment timestamps.
      form.append("response_format", "verbose_json");

      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        },
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await supabase
          .from("evidence")
          .update({ transcript_status: "failed" })
          .eq("id", row.id)
          .eq("user_id", userId);
        throw new Error(`Transcription failed (${res.status}): ${errText.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        text?: string;
        segments?: Array<{ start: number; end: number; text: string }>;
      };
      const rawSegments = Array.isArray(json.segments) ? json.segments : [];
      const segments = labelSpeakers(
        rawSegments.map((s) => ({
          start: Number(s.start ?? 0),
          end: Number(s.end ?? 0),
          text: String(s.text ?? ""),
        })),
      );
      const transcriptText = (json.text ?? segments.map((s) => s.text).join(" ")).trim();

      await supabase
        .from("evidence")
        .update({
          transcript: transcriptText,
          transcript_segments: segments,
          transcript_status: "ready",
          transcript_verified_at: null,
          transcript_verified_by: null,
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      return { ok: true as const, verified: false as const, segments: segments.length };
    } catch (err) {
      await supabase
        .from("evidence")
        .update({ transcript_status: "failed" })
        .eq("id", row.id)
        .eq("user_id", userId);
      throw err;
    }
  });

export const verifyTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ evidence_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("evidence")
      .update({
        transcript_verified_at: new Date().toISOString(),
        transcript_verified_by: userId,
      })
      .eq("id", data.evidence_id)
      .eq("user_id", userId);
    return { ok: true as const };
  });