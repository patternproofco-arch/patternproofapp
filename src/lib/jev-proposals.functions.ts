import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAttorneyPortalAuth } from "./attorney-portal-auth";
import {
  JEV_INSTRUCTION_VERSION,
  requestMatchQuestion,
  JEV_REVIEW_THRESHOLD,
  permitsJev,
  type JevRequestResult,
} from "./jev-proposals";
import type { JevEvidence, RankedJevSource } from "./jev-retrieval.server";

async function currentShare(attorneyId: string, clientId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { assertAttorney, assertLink } = await import("./attorney-access.server");
  const { readJevPermission } = await import("./jev-consent.server");
  await assertAttorney(db, attorneyId);
  const link = await assertLink(db, attorneyId, clientId);
  const permission = await readJevPermission(db, clientId, attorneyId, link);
  return { db, link, permission };
}
const COLUMNS =
  "id,title,description,mime,file_type,ai_permission,is_sealed,transcript,transcript_status,extracted_text";

/** Stage one is deliberately informational: no record mutation, saved AI link, or request action. */
export const suggestRequestMatches = createServerFn({ method: "POST" })
  .middleware([requireAttorneyPortalAuth])
  .inputValidator((input) =>
    z
      .object({
        clientId: z.string().uuid(),
        aiConsent: z.literal(true),
        title: z.string().trim().min(1).max(200),
        details: z.string().trim().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<JevRequestResult> => {
    const { db, link, permission } = await currentShare(context.userId, data.clientId);
    const { assertJevAvailable, evaluateJev } = await import("./jev.server");
    assertJevAvailable();
    const { requestTerms, rankJevSource, topJevSources, jevFingerprint } =
      await import("./jev-retrieval.server");
    const { selectInChunks } = await import("./in-chunks.server");
    const terms = requestTerms(`${data.title} ${data.details}`);
    let searchedCount = 0;
    let best: RankedJevSource[] = [];
    // Read the entire current scope in bounded batches. Select top candidates by relevance,
    // rather than treating the first grant IDs as representative of the case.
    const ids = [...new Set(link.scope_evidence ?? [])];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = await selectInChunks<JevEvidence>(
        ids.slice(offset, offset + 100),
        (chunk) =>
          db
            .from("evidence")
            .select(COLUMNS)
            .eq("user_id", data.clientId)
            .is("deleted_at", null)
            .in("id", chunk),
        { what: "shared file" },
      );
      const eligible = batch.filter(permitsJev);
      searchedCount += eligible.length;
      const ranked = await Promise.all(eligible.map((row) => rankJevSource(row, terms)));
      best = topJevSources([...best, ...ranked.filter((r): r is RankedJevSource => r !== null)]);
    }
    const base = {
      instructionVersion: JEV_INSTRUCTION_VERSION,
      searchedCount,
      checkedCount: best.length,
      expiresAt: new Date(
        Math.min(Date.now() + 5 * 60_000, Date.parse(permission.expiresAt)),
      ).toISOString(),
    };
    // The source revision and permission must still match immediately before material leaves the server.
    async function assertCurrent() {
      const fresh = await currentShare(context.userId, data.clientId);
      if (fresh.link.id !== link.id || fresh.permission.nonce !== permission.nonce)
        throw new Error("Authorization changed. Run the check again.");
      const rows = await selectInChunks<JevEvidence>(
        best.map((s) => s.evidenceId),
        (chunk) =>
          db
            .from("evidence")
            .select(COLUMNS)
            .eq("user_id", data.clientId)
            .is("deleted_at", null)
            .in("id", chunk),
        { what: "shared file" },
      );
      for (const source of best) {
        const row = rows.find((r) => r.id === source.evidenceId);
        if (
          !fresh.link.scope_evidence?.includes(source.evidenceId) ||
          !row ||
          !permitsJev(row) ||
          (await jevFingerprint(row)) !== source.sourceRevision
        ) {
          throw new Error("A checked file changed or is no longer available. Run the check again.");
        }
      }
    }
    await assertCurrent();
    if (!best.length) return { ...base, model: null, suggestion: null };
    const result = await evaluateJev(
      {
        request: { title: data.title, details: data.details },
        candidates: best.map((s, index) => ({
          id: `file_${index}`,
          title: s.title,
          format: s.format,
          excerpt: s.excerpt,
          sourceField: s.sourceField,
          excerptStart: s.excerptStart,
        })),
        coverage:
          "Selected excerpts from eligible shared records only. This is not a complete-document or full-vault assessment.",
      },
      {
        match: requestMatchQuestion(best.map((s) => s.title)),
      },
    );
    await assertCurrent();
    const answer = result.answers.match;
    const index =
      answer.type === "choice" ? best.findIndex((_, i) => answer.choice === `file_${i}`) : -1;
    const selected =
      answer.type === "choice" && answer.confidence >= JEV_REVIEW_THRESHOLD && index >= 0
        ? best[index]
        : null;
    // Provenance has identifiers/revisions, never request text or source excerpts. No records are changed.
    try {
      await db.rpc("record_audit_event", {
        p_user_id: data.clientId,
        p_event_type: "jev.request_match_checked",
        p_subject_kind: "attorney_client_link",
        p_subject_id: link.id,
        p_actor_kind: "user",
        p_actor_id: context.userId,
        p_meta: {
          model: result.model,
          instruction_version: JEV_INSTRUCTION_VERSION,
          sources: best.map((s) => ({ id: s.evidenceId, revision: s.sourceRevision })),
          proposed_source_id: selected?.evidenceId ?? null,
          action: "suggestion_only",
        },
      });
    } catch {
      /* Failed audit must not expose private content through logs or provider errors. */
    }
    return {
      ...base,
      model: result.model,
      suggestion: selected
        ? {
            evidenceId: selected.evidenceId,
            title: selected.title,
            excerpt: selected.excerpt,
            sourceField: selected.sourceField,
            excerptStart: selected.excerptStart,
            sourceRevision: selected.sourceRevision,
          }
        : null,
    };
  });
