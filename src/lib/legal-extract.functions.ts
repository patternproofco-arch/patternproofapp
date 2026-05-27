import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSupabaseStorageUrl } from "./safe-fetch.server";

const SYSTEM_PROMPT = `You are a legal document extraction assistant for a domestic violence documentation app. The user has uploaded a legal document. Extract all relevant information and return it as JSON only with no other text, no preamble, no markdown.

Extract these fields (use null for any field not found):
{
  "document_type_confirmed": "string — your assessment of what this document is",
  "case_number": "string or null",
  "court_name": "string or null",
  "judge_name": "string or null",
  "effective_date": "YYYY-MM-DD or null",
  "expiration_date": "YYYY-MM-DD or null",
  "protected_party": "string or null — name of person being protected",
  "restrained_party": "string or null — name of person being restrained",
  "issuing_officer": "string or null — officer name if police report",
  "incident_date": "YYYY-MM-DD or null",
  "key_terms": "string or null — the most important restrictions, findings, or terms in plain language, maximum 3 sentences",
  "suggested_title": "string — a short descriptive title for this document",
  "cross_reference_note": "string or null — anything in this document that should be linked to other records, e.g. an incident date that may match a journal entry"
}`;

export const extractLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      signedUrl: z.string().url().max(2000),
      mimeType: z.string().min(1).max(120),
      documentType: z.string().min(1).max(40),
      filename: z.string().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "missing-key" };

    // Accept images and PDFs. The gateway forwards data URIs to Gemini which
    // can read both image inputs and PDF documents.
    const isImage = data.mimeType.startsWith("image/");
    const isPdf = data.mimeType === "application/pdf";
    if (!isImage && !isPdf) {
      return { ok: false as const, reason: "unsupported-format" };
    }

    // Fetch the file and convert to data URI
    let dataUri: string;
    try {
      assertSupabaseStorageUrl(data.signedUrl);
      const fileRes = await fetch(data.signedUrl);
      if (!fileRes.ok) return { ok: false as const, reason: "fetch-failed" };
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) return { ok: false as const, reason: "too-large" };
      dataUri = `data:${data.mimeType};base64,${buf.toString("base64")}`;
    } catch {
      return { ok: false as const, reason: "fetch-failed" };
    }

    const userContent = [
      { type: "text", text: `The user says this is a: ${data.documentType}. Extract the JSON now.` },
      { type: "image_url", image_url: { url: dataUri } },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 1000,
      }),
    });

    if (!res.ok) return { ok: false as const, reason: `ai-${res.status}` };
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true as const, extracted: parsed };
    } catch {
      return { ok: false as const, reason: "parse-failed" };
    }
  });