import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side audio transcription for voice notes.
 * Downloads the audio from the private `voice-notes` bucket using the
 * authenticated user's client (so RLS applies), sends it to Lovable AI
 * Gateway (Gemini 2.5 Flash with audio inline), and writes the transcript
 * back to the row.
 */
export const transcribeVoiceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      voiceNoteId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "missing-key" };

    const { data: note, error: noteErr } = await supabase
      .from("voice_notes")
      .select("id, audio_url, duration_seconds")
      .eq("id", data.voiceNoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (noteErr || !note) return { ok: false as const, reason: "not-found" };

    // Cap at ~10 minutes — beyond that we'd need chunking.
    if (note.duration_seconds && note.duration_seconds > 600) {
      await supabase.from("voice_notes")
        .update({ transcription_status: "too_long" })
        .eq("id", note.id);
      return { ok: false as const, reason: "too-long" };
    }

    await supabase.from("voice_notes")
      .update({ transcription_status: "processing" })
      .eq("id", note.id);

    const signed = await supabase.storage.from("voice-notes").createSignedUrl(note.audio_url, 600);
    if (!signed.data?.signedUrl) {
      await supabase.from("voice_notes").update({ transcription_status: "failed" }).eq("id", note.id);
      return { ok: false as const, reason: "signed-url-failed" };
    }

    let dataUri: string;
    try {
      const fileRes = await fetch(signed.data.signedUrl);
      if (!fileRes.ok) throw new Error("fetch failed");
      const buf = Buffer.from(await fileRes.arrayBuffer());
      // Lovable AI inline audio limit — keep under ~15 MB.
      if (buf.length > 15 * 1024 * 1024) {
        await supabase.from("voice_notes").update({ transcription_status: "too_long" }).eq("id", note.id);
        return { ok: false as const, reason: "too-large" };
      }
      dataUri = `data:audio/webm;base64,${buf.toString("base64")}`;
    } catch {
      await supabase.from("voice_notes").update({ transcription_status: "failed" }).eq("id", note.id);
      return { ok: false as const, reason: "fetch-failed" };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You transcribe voice memos for a domestic-abuse documentation app. Return ONLY the verbatim transcript in plain text. No preface, no commentary, no labels. Preserve the speaker's own words. If audio is silent or unintelligible, return exactly: [unintelligible]" },
          { role: "user", content: [
            { type: "text", text: "Transcribe this recording verbatim." },
            { type: "input_audio", input_audio: { data: dataUri.split(",")[1], format: "webm" } },
          ] },
        ],
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      await supabase.from("voice_notes").update({ transcription_status: "failed" }).eq("id", note.id);
      if (res.status === 429) return { ok: false as const, reason: "rate-limit" };
      if (res.status === 402) return { ok: false as const, reason: "credits" };
      return { ok: false as const, reason: "ai-failed" };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const transcript = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!transcript) {
      await supabase.from("voice_notes").update({ transcription_status: "failed" }).eq("id", note.id);
      return { ok: false as const, reason: "empty" };
    }

    await supabase.from("voice_notes")
      .update({
        transcript,
        transcribed_at: new Date().toISOString(),
        transcription_status: "complete",
      })
      .eq("id", note.id);

    return { ok: true as const, transcript };
  });