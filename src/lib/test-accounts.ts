/** Internal walk-through accounts. Never treat these as production users. */
export const TEST_ACCOUNT_EMAILS = [
  "attorneyppme@yahoo.com",
  "advocateppme@gmail.com",
  "survivorppme@gmail.com",
  "savinggrace.homereset@gmail.com",
] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isTestAccountEmail(email: string | null | undefined): boolean {
  return (TEST_ACCOUNT_EMAILS as readonly string[]).includes(normalizeEmail(email));
}

export function testAccountRole(
  email: string | null | undefined,
): "attorney" | "advocate" | "survivor" | null {
  const e = normalizeEmail(email);
  if (e === "attorneyppme@yahoo.com" || e === "savinggrace.homereset@gmail.com") return "attorney";
  if (e === "advocateppme@gmail.com") return "advocate";
  if (e === "survivorppme@gmail.com") return "survivor";
  return isTestAccountEmail(e) ? "survivor" : null;
}
