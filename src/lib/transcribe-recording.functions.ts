import { fetchAiGateway } from "@/lib/ai-release-policy.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Transcribes a just-finished voice recording (≤ 60s) when the browser could
// not produce a live transcript. The text is a draft the survivor reviews.
const MAX_BYTES = 8 * 1024 * 1024;

export const transcribeRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        audioBase64: z.string().min(1).max(Math.ceil((MAX_BYTES * 4) / 3) + 8),
        mime: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { text: "", error: "Transcription isn't available right now." };
    const bytes = Buffer.from(data.audioBase64, "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) {
      return { text: "", error: "This recording is too large to transcribe." };
    }
    const baseMime = data.mime.split(";")[0];
    const ext = baseMime.includes("mp4") ? "m4a" : baseMime.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("model", "google/gemini-3.5-transcribe");
    form.append("file", new File([bytes], `recording.${ext}`, { type: baseMime }));
    form.append("response_format", "json");
    const res = await fetchAiGateway("transcribe-recording", "audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const msg =
        res.status === 402 || res.status === 429
          ? "Transcription is paused for a moment. Your recording is still here."
          : "We couldn't transcribe this recording. You can still save it.";
      return { text: "", error: msg, status: res.status };
    }
    const json = (await res.json().catch(() => ({}))) as { text?: string };
    return { text: String(json.text ?? "").trim(), error: null };
  });
