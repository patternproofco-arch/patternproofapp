import React from "react";
import { render } from "@react-email/render";
import TeamInvitationEmail from "@/lib/email-templates/team-invitation";
import { teamInvitationSubject } from "@/lib/email-templates/team-invitation.config";
import type { Json } from "@/integrations/supabase/types";

const SITE_ORIGIN = process.env.SITE_URL || "https://pattern-proof.tech";

export type TeamInvitationInput = {
  invitationId: string;
  email: string;
  teamName: string;
  teamKind: "firm" | "organization";
  role: "admin" | "member";
  token: string;
  expiresDays: number;
};

export async function buildTeamInvitationMessage(
  input: TeamInvitationInput,
  siteOrigin = SITE_ORIGIN,
) {
  const fragmentKey = input.teamKind === "firm" ? "firm" : "org";
  const acceptUrl = `${siteOrigin.replace(/\/$/, "")}/team-invite#${fragmentKey}=${encodeURIComponent(input.token)}`;
  const props = {
    teamName: input.teamName,
    teamKind: input.teamKind,
    role: input.role,
    acceptUrl,
    expiresLabel: `${input.expiresDays} day${input.expiresDays === 1 ? "" : "s"}`,
  } as const;
  const element = React.createElement(TeamInvitationEmail, props);
  const [html, plainText] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  const subject = teamInvitationSubject(props.teamName);
  return {
    acceptUrl,
    payload: {
      message_id: crypto.randomUUID(),
      to: input.email,
      from: "PatternProof <noreply@pattern-proof.tech>",
      sender_domain: "notify.pattern-proof.tech",
      subject,
      html,
      text: plainText,
      purpose: "transactional",
      label: "team-invitation",
      idempotency_key: `team-invitation:${input.invitationId}`,
      queued_at: new Date().toISOString(),
    },
  };
}

export async function enqueueTeamInvitation(input: TeamInvitationInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const message = await buildTeamInvitationMessage(input);
  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: message.payload as Json,
  });
  if (error) throw new Error("Invitation created, but the email could not be queued.");
  return { acceptUrl: message.acceptUrl };
}

export async function recordTeamAudit(input: {
  actorId: string;
  actorKind: "attorney" | "advocate";
  eventType: string;
  subjectKind: "firm" | "organization";
  subjectId: string;
  meta?: Json;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("record_audit_event", {
    p_user_id: input.actorId,
    p_event_type: input.eventType,
    p_subject_kind: input.subjectKind,
    p_subject_id: input.subjectId,
    p_actor_kind: input.actorKind,
    p_actor_id: input.actorId,
    p_meta: input.meta ?? {},
  });
  if (error) console.error("[audit] team event log failed", { eventType: input.eventType });
}

export async function runTeamRpc(
  name:
    | "remove_firm_member"
    | "change_firm_member_role"
    | "remove_org_member"
    | "change_org_member_role",
  args: Record<string, string>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    functionName: string,
    parameters: Record<string, string>,
  ) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc(name, args);
  if (error) throw new Error(error.message);
}
