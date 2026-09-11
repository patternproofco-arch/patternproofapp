import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Active client-matter caps. Supersedes docs/attorney-beta-pricing.md's Aug
 * 30 2026 "does not approve... matter limits" note — the founder explicitly
 * asked for these numbers on Sept 11 2026 rather than leaving matters
 * unmetered indefinitely. See that doc's addendum for the record.
 *
 * Solo gets a flat cap; a firm's seats share one pool at the same
 * per-attorney rate, scaled by how many colleagues are actually seated
 * (via the trusted firm_members table, not a self-editable field).
 */
export const SOLO_MATTER_CAP = 10;
export const MATTER_CAP_PER_SEAT = 10;

export async function assertMatterCapacity(
  supabaseAdmin: SupabaseClient,
  attorneyUserId: string,
) {
  const { data: membership } = await supabaseAdmin
    .from("firm_members")
    .select("firm_id")
    .eq("user_id", attorneyUserId)
    .maybeSingle();

  if (!membership) {
    const { count } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id", { count: "exact", head: true })
      .eq("attorney_user_id", attorneyUserId)
      .eq("status", "active");
    if ((count ?? 0) >= SOLO_MATTER_CAP) {
      throw new Error(
        `You've reached the ${SOLO_MATTER_CAP}-matter limit for a Solo Attorney account.`,
      );
    }
    return;
  }

  const { data: colleagues } = await supabaseAdmin
    .from("firm_members")
    .select("user_id")
    .eq("firm_id", membership.firm_id);
  const memberIds = (colleagues ?? []).map((c) => c.user_id as string);
  const cap = MATTER_CAP_PER_SEAT * Math.max(1, memberIds.length);
  const { count } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id", { count: "exact", head: true })
    .in("attorney_user_id", memberIds)
    .eq("status", "active");
  if ((count ?? 0) >= cap) {
    throw new Error(
      `This firm has reached its active-matter limit (${cap}, based on ${memberIds.length} seat${memberIds.length === 1 ? "" : "s"}).`,
    );
  }
}
