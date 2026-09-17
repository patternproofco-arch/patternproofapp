import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -----------------------------------------------------------------------------
// Reads the text out of an uploaded PDF, Word file or plain-text file and
// stores it on the evidence row for human review.
//
// A scanned PDF (no text layer) falls back to a reading pass through the AI
// gateway. That result is always marked as machine-read and unverified — the
// UI shows it beside the original so the survivor can correct it. Nothing here
// interprets, summarises or classifies the content.
// -----------------------------------------------------------------------------

const READ_ALOUD_PROMPT = `Transcribe every piece of visible text in this document verbatim, page by page.
Rules:
- Output only the text you can actually see, in reading order.
- Start each page with a line of the form "--- Page N ---".
- Do not summarise, interpret, correct, translate or add commentary.
- If part of a page is illegible, write [illegible] in place of that text.`;

export const extractEvidenceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ evidence_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { extractDocumentText } = await import("@/lib/document-extract.server");

    const rowRes = await supabase
      .from("evidence")
      .select("id, file_url, mime, original_filename, is_sealed, ai_permission")
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
      is_sealed: boolean | null;
      ai_permission: string | null;
    };
    if (row.is_sealed) {
      return { ok: false as const, status: "sealed" as const, chars: 0 };
    }

    await supabase
      .from("evidence")
      .update({ extraction_status: "pending" })
      .eq("id", row.id)
      .eq("user_id", userId);

    const dl = await supabase.storage.from("evidence-files").download(row.file_url);
    if (dl.error || !dl.data) {
      await supabase
        .from("evidence")
        .update({ extraction_status: "failed" })
        .eq("id", row.id)
        .eq("user_id", userId);
      return { ok: false as const, status: "failed" as const, chars: 0 };
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer());

    let result;
    try {
      result = await extractDocumentText(bytes, row.mime ?? "", row.original_filename);
    } catch {
      await supabase
        .from("evidence")
        .update({ extraction_status: "failed" })
        .eq("id", row.id)
        .eq("user_id", userId);
      return { ok: false as const, status: "failed" as const, chars: 0 };
    }

    // Scanned pages: fall back to a machine reading pass, unless the survivor
    // has withheld AI permission for this item.
    const aiAllowed = row.ai_permission !== "none" && row.ai_permission !== "denied";
    if (result.status === "needs_ocr" && aiAllowed) {
      const readBack = await readScannedDocument(bytes, row.mime ?? "application/pdf");
      if (readBack) {
        result = {
          text: readBack,
          method: "read-aloud" as const,
          status: "ready" as const,
          pages: result.pages,
        };
      }
    }

    await supabase
      .from("evidence")
      .update({
        extracted_text: result.text || null,
        extraction_method: result.method,
        extraction_pages: result.pages,
        extraction_status: result.status,
        extracted_at: new Date().toISOString(),
        extraction_verified_at: null,
        extraction_verified_by: null,
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    return {
      ok: result.status === "ready",
      status: result.status,
      method: result.method,
      pages: result.pages,
      chars: result.text.length,
    };
  });

async function readScannedDocument(bytes: Uint8Array, mime: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  if (bytes.byteLength > 8 * 1024 * 1024) return null;
  const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        messages: [
          { role: "system", content: READ_ALOUD_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this document now." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return text || null;
  } catch {
    return null;
  }
}

/** The survivor confirms the stored text matches the document in front of her. */
export const verifyExtractedText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evidence_id: z.string().uuid(),
        corrected_text: z.string().max(200000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const corrected = typeof data.corrected_text === "string";
    const patch = {
      extraction_verified_at: new Date().toISOString(),
      extraction_verified_by: userId,
      ...(corrected
        ? {
            extracted_text: data.corrected_text as string,
            extraction_method: "human-corrected",
            extraction_status: "ready",
          }
        : {}),
    };

    const res = await supabase
      .from("evidence")
      .update(patch)
      .eq("id", data.evidence_id)
      .eq("user_id", userId);
    if (res.error) throw new Error("We couldn't save that. Try again in a moment.");
    return { ok: true as const };
  });
