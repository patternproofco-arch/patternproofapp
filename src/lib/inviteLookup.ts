export type InviteRole = "survivor" | "attorney" | "firm" | "advocate" | "org" | null;

export type InviteLookupResult = {
  exists: boolean;
  role: InviteRole;
  subscriptionActive?: boolean;
  message: string;
  chargeSurvivor: false;
};

/** Pure branch table for professional invites. Survivors are never billed. */
export function resolveInvite(input: {
  exists: boolean;
  role: InviteRole;
  subscriptionActive?: boolean;
}): InviteLookupResult {
  const { exists, role, subscriptionActive } = input;

  if (!exists) {
    return {
      exists: false,
      role: null,
      chargeSurvivor: false,
      message:
        "Invited. They can open a scoped review link, then create their own account. Attorneys subscribe themselves if they want a workspace.",
    };
  }

  if (role === "survivor") {
    return {
      exists: true,
      role,
      chargeSurvivor: false,
      message: "That email is already a survivor account. Ask for a work email, or send a view-only share.",
    };
  }

  if (role === "advocate" || role === "org") {
    return {
      exists: true,
      role,
      chargeSurvivor: false,
      message: "Shared. Free.",
    };
  }

  if (role === "attorney" || role === "firm") {
    return {
      exists: true,
      role,
      subscriptionActive: !!subscriptionActive,
      chargeSurvivor: false,
      message: subscriptionActive
        ? "Shared. Free."
        : "Shared as view-only. They can subscribe themselves to add notes and caseload.",
    };
  }

  return {
    exists: true,
    role,
    chargeSurvivor: false,
    message: "Shared. Free.",
  };
}
