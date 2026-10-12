type Scope = {
  scope_incidents: string[];
  scope_evidence: string[];
  include_patterns?: boolean;
};

/** Only trusted server callers supply the authenticated actor and frozen ids. */
export async function acceptAttorneyShare(
  // Generated database types are refreshed by the host after migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: {
    invitationId: string;
    actorId: string;
    direction: "attorney" | "survivor";
    scope: Scope;
  },
): Promise<{ id: string; client_user_id: string }> {
  const { data, error } = await admin.rpc("accept_attorney_share", {
    _invitation_id: input.invitationId,
    _actor_id: input.actorId,
    _direction: input.direction,
    _scope: {
      scope_incidents: input.scope.scope_incidents,
      scope_evidence: input.scope.scope_evidence,
      include_patterns: input.scope.include_patterns ?? false,
    },
  });
  if (error || !data?.[0]?.id || !data[0].client_user_id) {
    throw new Error(error?.message ?? "The invitation could not be accepted. Try again.");
  }
  return data[0];
}
