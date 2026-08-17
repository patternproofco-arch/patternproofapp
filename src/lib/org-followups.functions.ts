import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  followUpCreateSchema, followUpUpdateSchema,
  referralEngagementCreateSchema, referralEngagementUpdateSchema,
} from "@/lib/record-requests.schema";
import { advocateClient, audit } from "@/lib/record-requests.server";

/**
 * Warm handoffs and referral engagement.
 *
 * Coordination only. Nothing in these tables is evidence, nothing here is
 * copied into a survivor's record, and nothing here appears in a
 * professional-review packet or any evidence export.
 */

export const listFollowUps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await advocateClient(context.userId);
    const { data: followUps } = await db.from("org_follow_ups").select("*")
      .eq("org_user_id", context.userId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200);
    const { data: engagements } = await db.from("referral_engagements").select("*")
      .eq("org_user_id", context.userId).order("created_at", { ascending: false }).limit(200);
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      follow_ups: ((followUps ?? []) as any[]).map((f) => ({
        id: f.id as string,
        reference_label: f.reference_label as string | null,
        resource_reference: f.resource_reference as string | null,
        status: f.status as string,
        due_at: f.due_at as string | null,
        note: f.note as string | null,
        created_at: f.created_at as string,
        updated_at: f.updated_at as string,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      engagements: ((engagements ?? []) as any[]).map((e) => ({
        id: e.id as string,
        referral_code: e.referral_code as string | null,
        status: e.status as string,
        note: e.note as string | null,
        created_at: e.created_at as string,
      })),
    };
  });

export const createFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => followUpCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);

    // A follow-up may only name someone already connected to this organization.
    if (data.survivor_user_id) {
      const { data: link } = await db.from("advocate_client_links").select("id")
        .eq("advocate_user_id", context.userId)
        .eq("client_user_id", data.survivor_user_id).maybeSingle();
      if (!link) throw new Error("You can only track a handoff for someone connected with your organization.");
    }

    const { data: row, error } = await db.from("org_follow_ups").insert({
      org_user_id: context.userId,
      survivor_user_id: data.survivor_user_id ?? null,
      grant_id: data.grant_id ?? null,
      reference_label: data.reference_label ?? null,
      resource_reference: data.resource_reference ?? null,
      status: data.status,
      due_at: data.due_at ?? null,
      note: data.note ?? null,
      created_by: context.userId,
      updated_by: context.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);

    await audit(db, context.userId, "warm_handoff_created", "org_follow_up", row.id,
      "advocate", context.userId, { status: data.status });
    return { follow_up: row };
  });

export const updateFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => followUpUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: row } = await db.from("org_follow_ups").select("id,status")
      .eq("id", data.id).eq("org_user_id", context.userId).maybeSingle();
    if (!row) throw new Error("That handoff isn't on your account.");

    const patch: Record<string, unknown> = { updated_by: context.userId };
    if (data.status !== undefined) patch["status"] = data.status;
    if (data.due_at !== undefined) patch["due_at"] = data.due_at;
    if (data.note !== undefined) patch["note"] = data.note;

    const { error } = await db.from("org_follow_ups").update(patch)
      .eq("id", data.id).eq("org_user_id", context.userId);
    if (error) throw new Error(error.message);

    if (data.status && data.status !== row.status) {
      await audit(db, context.userId, "warm_handoff_status_changed", "org_follow_up", data.id,
        "advocate", context.userId, { from: row.status, to: data.status });
    }
    return { ok: true };
  });

export const createReferralEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => referralEngagementCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    if (data.referral_code) {
      const { data: owned } = await db.from("referral_links").select("code")
        .eq("code", data.referral_code).eq("org_user_id", context.userId).maybeSingle();
      if (!owned) throw new Error("That code isn't on your account.");
    }
    const { data: row, error } = await db.from("referral_engagements").insert({
      org_user_id: context.userId,
      survivor_user_id: data.survivor_user_id ?? null,
      referral_code: data.referral_code ?? null,
      status: data.status,
      note: data.note ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "referral_engagement_created", "referral_engagement", row.id,
      "advocate", context.userId, { status: data.status });
    return { engagement: row };
  });

export const updateReferralEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => referralEngagementUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: row } = await db.from("referral_engagements").select("id,status")
      .eq("id", data.id).eq("org_user_id", context.userId).maybeSingle();
    if (!row) throw new Error("That referral isn't on your account.");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.note !== undefined) patch["note"] = data.note;
    const { error } = await db.from("referral_engagements").update(patch)
      .eq("id", data.id).eq("org_user_id", context.userId);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "referral_engagement_status_changed", "referral_engagement", data.id,
      "advocate", context.userId, { from: row.status, to: data.status });
    return { ok: true };
  });
