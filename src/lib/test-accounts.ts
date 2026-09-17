/** Production builds must not treat any email as a privileged test user. */
export const TEST_ACCOUNT_EMAILS = [] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isTestAccountEmail(_email: string | null | undefined): boolean {
  return false;
}

export function testAccountRole(
  _email: string | null | undefined,
): "attorney" | "advocate" | "survivor" | null {
  return null;
}
