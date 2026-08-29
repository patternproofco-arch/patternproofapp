export type TeamRole = "owner" | "admin" | "member";
export type ManagedTeamRole = Exclude<TeamRole, "owner">;

export function canInviteRole(actorRole: TeamRole, invitedRole: ManagedTeamRole): boolean {
  return actorRole === "owner" || (actorRole === "admin" && invitedRole === "member");
}

export function canRemoveMember(actorRole: TeamRole, targetRole: TeamRole): boolean {
  if (targetRole === "owner") return false;
  return actorRole === "owner" || (actorRole === "admin" && targetRole === "member");
}

export function canChangeMemberRole(
  actorRole: TeamRole,
  targetRole: TeamRole,
  _nextRole: ManagedTeamRole,
): boolean {
  if (targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  return false;
}
