import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAttorneyPortalAuth } from "./attorney-portal-auth";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JEV_BATCH_SIZE,
  JEV_CANDIDATE_LIMIT,
  JEV_REVIEW_THRESHOLD,
  RECORD_GROUPS,
  permitsJev,
} from "./jev-proposals";
import type { JevChoiceProposal, JevDraftCheck, RecordGroup } from "./jev-proposals";

const consent = z.literal(true);
const clientInput = z.object({ clientId: z.string().uuid(), aiConsent: consent });
type Admin = SupabaseClient<Database>;

async function currentShare(attorneyId: string, clientId: string) {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { assertAttorney, assertLink } = await import("./attorney-access.server");
  await assertAttorney(admin, attorneyId);
  const link = await assertLink(admin, attorneyId, clientId);
  return { admin, link };
}

async function loadFiles(admin: Admin, clientId: string, scope: string[], selected: string[]) {
  const ids = [...new Set(selected)];
  if (ids.some((id) => !scope.includes(id)))
    throw new Error("That file is not in the current share.");
  if (!ids.length) return [];
  const { data, error } = await admin
    .from("evidence")
    .select(
      "id,title,description,mime,file_type,ai_permission,is_sealed,transcript,transcript_status,extracted_text",
    )
    .eq("user_id", clientId)
    .is("deleted_at", null)
    .in("id", ids);
  if (error) throw new Error("We couldn't check those files. Please try again.");
  return (data ?? []).filter(permitsJev).map((row) => ({
    id: row.id,
    title: row.title.slice(0, 200),
    description: row.description?.slice(0, 800),
    format: row.mime || row.file_type,
    // Send bounded existing text, never file URLs, storage keys, GPS or original bytes.
    text: (row.transcript_status === "ready" ? row.transcript : row.extracted_text)?.slice(0, 1200),
  }));
}

async function loadEntries(admin: Admin, clientId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await admin
    .from("incidents")
    .select("id,date,location,description,ai_permission,is_sealed,is_draft")
    .eq("user_id", clientId)
    .is("deleted_at", null)
    .in("id", ids);
  if (error) throw new Error("We couldn't check those entries. Please try again.");
  return (data ?? [])
    .filter((r) => permitsJev(r) && !r.is_draft)
    .map((r) => ({
      id: r.id,
      date: r.date,
      location: r.location?.slice(0, 200),
      description: r.description.slice(0, 1000),
    }));
}

function choices(rows: Array<{ id: string }>, label: (id: string) => string) {
  return Object.fromEntries([
    ["none", "No clear match, insufficient information or uncertain"],
    ...rows.map((row) => [row.id, label(row.id)]),
  ]);
}

function proposal(
  answer: import("./jev.server").JevAnswer,
  rows: Array<{ id: string }>,
  label: (id: string) => string,
): JevChoiceProposal | null {
  if (
    answer.type !== "choice" ||
    answer.choice === "none" ||
    answer.confidence < JEV_REVIEW_THRESHOLD ||
    !rows.some((r) => r.id === answer.choice)
  )
    return null;
  return { id: answer.choice, label: label(answer.choice), confidence: answer.confidence };
}

/** Both the provider input and the returned proposal must fit CURRENT consent scope. */
export const suggestEntryLink = createServerFn({ method: "POST" })
  .middleware([requireAttorneyPortalAuth])
  .inputValidator((input) => clientInput.extend({ evidenceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, link } = await currentShare(context.userId, data.clientId);
    const { assertJevAvailable, evaluateJev } = await import("./jev.server");
    assertJevAvailable();
    const files = await loadFiles(admin, data.clientId, link.scope_evidence ?? [], [
      data.evidenceId,
    ]);
    if (!files.length)
      throw new Error("That file isn't available for AI review. You can review manually.");
    const entries = await loadEntries(
      admin,
      data.clientId,
      (link.scope_incidents ?? []).slice(0, JEV_CANDIDATE_LIMIT),
    );
    if (!entries.length) return { model: null, suggestion: null, checkedCount: 0 };
    const label = (id: string) => {
      const e = entries.find((r) => r.id === id)!;
      return `${e.date ?? "Date unknown"} · ${e.description.slice(0, 100)}`;
    };
    const result = await evaluateJev(
      { file: files[0], entries },
      {
        match: {
          type: "choice",
          instructions:
            "Which supplied documented entry, if any, does this file directly describe? Use none when uncertain. Similar subject matter alone is insufficient. Do not infer an event date from upload or file dates.",
          criteria: choices(entries, label),
        },
      },
    );
    const fresh = await currentShare(context.userId, data.clientId);
    const visibleFiles = await loadFiles(admin, data.clientId, fresh.link.scope_evidence ?? [], [
      data.evidenceId,
    ]);
    const visibleEntries = await loadEntries(
      admin,
      data.clientId,
      entries.map((e) => e.id).filter((id) => fresh.link.scope_incidents?.includes(id)),
    );
    if (fresh.link.id !== link.id || !visibleFiles.length)
      throw new Error("The share changed. Run the check again.");
    return {
      model: result.model,
      suggestion: proposal(result.answers.match, visibleEntries, label),
      checkedCount: entries.length,
    };
  });

export const suggestRecordGroups = createServerFn({ method: "POST" })
  .middleware([requireAttorneyPortalAuth])
  .inputValidator((input) =>
    clientInput
      .extend({ evidenceIds: z.array(z.string().uuid()).min(1).max(JEV_BATCH_SIZE) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, link } = await currentShare(context.userId, data.clientId);
    const { assertJevAvailable, evaluateJev } = await import("./jev.server");
    assertJevAvailable();
    const files = await loadFiles(
      admin,
      data.clientId,
      link.scope_evidence ?? [],
      data.evidenceIds,
    );
    if (!files.length)
      return { model: null, groups: [] as Array<{ evidenceId: string; group: RecordGroup }> };
    const result = await evaluateJev(
      { files },
      Object.fromEntries(
        files.map((f) => [
          f.id,
          {
            type: "choice" as const,
            instructions: `Group only file ${f.id} by its record format/content. Never assess conduct, severity, credibility, relevance or legal value. Use other if uncertain.`,
            criteria: RECORD_GROUPS,
          },
        ]),
      ),
    );
    const fresh = await currentShare(context.userId, data.clientId);
    if (fresh.link.id !== link.id) throw new Error("The share changed. Run the check again.");
    const visible = await loadFiles(
      admin,
      data.clientId,
      fresh.link.scope_evidence ?? [],
      data.evidenceIds,
    );
    return {
      model: result.model,
      groups: visible.map((file) => {
        const a = result.answers[file.id];
        return {
          evidenceId: file.id,
          group: (a.type === "choice" && a.confidence >= JEV_REVIEW_THRESHOLD
            ? a.choice
            : "other") as RecordGroup,
        };
      }),
    };
  });

export const suggestRequestMatches = createServerFn({ method: "POST" })
  .middleware([requireAttorneyPortalAuth])
  .inputValidator((input) =>
    clientInput
      .extend({
        title: z.string().trim().min(1).max(200),
        details: z.string().trim().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, link } = await currentShare(context.userId, data.clientId);
    const { assertJevAvailable, evaluateJev } = await import("./jev.server");
    assertJevAvailable();
    const ids = (link.scope_evidence ?? []).slice(0, JEV_CANDIDATE_LIMIT);
    const files = await loadFiles(admin, data.clientId, link.scope_evidence ?? [], ids);
    if (!files.length) return { model: null, suggestion: null, checkedCount: 0 };
    const label = (id: string) => files.find((f) => f.id === id)!.title;
    const result = await evaluateJev(
      { request: { title: data.title, details: data.details }, files },
      {
        match: {
          type: "choice",
          instructions:
            "Which supplied shared file, if any, appears to be the item described in this request? Use none if uncertain. This does not decide whether the request is fulfilled or whether other files exist.",
          criteria: choices(files, label),
        },
      },
    );
    const fresh = await currentShare(context.userId, data.clientId);
    if (fresh.link.id !== link.id) throw new Error("The share changed. Run the check again.");
    const visible = await loadFiles(
      admin,
      data.clientId,
      fresh.link.scope_evidence ?? [],
      ids.filter((id) => fresh.link.scope_evidence?.includes(id)),
    );
    return {
      model: result.model,
      suggestion: proposal(result.answers.match, visible, label),
      checkedCount: files.length,
    };
  });

const draftSchema = z.object({
  date: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().max(4000).default(""),
});

export const checkDraftWithJev = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        proposalId: z.string().uuid(),
        aiConsent: consent,
        candidateIds: z.array(z.string().uuid()).max(JEV_BATCH_SIZE),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<JevDraftCheck> => {
    const { assertJevAvailable, evaluateJev } = await import("./jev.server");
    assertJevAvailable();
    const ids = [...new Set([data.proposalId, ...data.candidateIds])];
    const load = async () => {
      const { data: rows, error } = await context.supabase
        .from("proposed_incidents")
        .select("id,draft,source_evidence_ids")
        .eq("user_id", context.userId)
        .eq("status", "pending")
        .in("id", ids);
      if (error) throw new Error("We couldn't check your drafts. Try again.");
      // A draft may contain text copied from its sources. Every source must still be owned,
      // undeleted and AI-eligible, or the ENTIRE draft stays out of the provider input.
      const sourceIds = [...new Set((rows ?? []).flatMap((r) => r.source_evidence_ids))];
      const { selectInChunks } = await import("./in-chunks.server");
      const sources = await selectInChunks<{
        id: string;
        ai_permission: string;
        is_sealed: boolean;
      }>(sourceIds, (chunk) =>
        context.supabase
          .from("evidence")
          .select("id,ai_permission,is_sealed")
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .in("id", chunk),
      );
      const allowed = new Set(sources.filter(permitsJev).map((s) => s.id));
      return (rows ?? [])
        .filter((r) => r.source_evidence_ids.every((id) => allowed.has(id)))
        .flatMap((r) => {
          const parsed = draftSchema.safeParse(r.draft);
          return parsed.success ? [{ id: r.id, ...parsed.data }] : [];
        });
    };
    const rows = await load();
    const draft = rows.find((r) => r.id === data.proposalId);
    if (!draft)
      throw new Error("That draft isn't available for AI review. You can edit it manually.");
    const candidates = rows.filter((r) => r.id !== draft.id);
    const label = (id: string) => {
      const r = candidates.find((c) => c.id === id)!;
      return `${r.date || "Date unknown"} · ${r.description.slice(0, 100)}`;
    };
    const questions: Record<string, import("./jev.server").JevQuestion> = {
      date: {
        type: "noul",
        instructions:
          "Is the event date absent or unclear in the target draft? Never use file dates as event dates. This only flags a field for human review.",
      },
      place: {
        type: "noul",
        instructions:
          "Is the event place absent or unclear in the target draft? Do not infer a location. This only flags a field for human review.",
      },
    };
    if (candidates.length)
      questions.duplicate = {
        type: "choice",
        instructions:
          "Which other draft, if any, appears to describe the exact same event as the target draft? Recurring similar events are not duplicates. Use none when uncertain. Never merge or discard records.",
        criteria: choices(candidates, label),
      };
    const result = await evaluateJev({ target: draft, candidates }, questions);
    const fresh = await load();
    if (!fresh.some((r) => r.id === draft.id))
      throw new Error("The draft changed. Run the check again.");
    return {
      model: result.model,
      duplicate: result.answers.duplicate
        ? proposal(
            result.answers.duplicate,
            fresh.filter((r) => r.id !== draft.id),
            label,
          )
        : null,
      checkDate:
        result.answers.date.type === "noul" && result.answers.date.noul >= JEV_REVIEW_THRESHOLD,
      checkPlace:
        result.answers.place.type === "noul" && result.answers.place.noul >= JEV_REVIEW_THRESHOLD,
      checkedCount: candidates.length,
    };
  });
