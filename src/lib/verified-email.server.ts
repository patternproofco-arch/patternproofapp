/**
 * Confirmed account email, read from auth.users through the admin client.
 * Profile tables keep a display copy, but anything a survivor relies on
 * (matching an existing share, showing who has access) and anything the server
 * writes into a profile must come from here, never from a form value or a
 * user-editable column.
 */
type Admin = {
  auth: {
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: { email?: string | null; email_confirmed_at?: string | null } | null };
        error: unknown;
      }>;
    };
  };
};

export async function confirmedAuthEmail(admin: Admin, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email?.trim().toLowerCase();
    if (error || !email || !data?.user?.email_confirmed_at) return null;
    return email;
  } catch {
    return null;
  }
}

export async function requireConfirmedAuthEmail(admin: Admin, userId: string): Promise<string> {
  const email = await confirmedAuthEmail(admin, userId);
  if (!email) throw new Error("Confirm your account email first, then try again.");
  return email;
}

export async function confirmedAuthEmails(
  admin: Admin,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(userIds));
  const pairs = await Promise.all(
    unique.map(async (id) => [id, await confirmedAuthEmail(admin, id)] as const),
  );
  return new Map(pairs);
}
