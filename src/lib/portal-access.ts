/** Routing is presentation only; server endpoints must enforce their own access. */
export function resolvePortal(result: {
  roles: string[];
  attorney_approved?: boolean;
  is_survivor: boolean;
  is_org_partner: boolean;
}) {
  // Dual-role accounts may use their survivor space, with the same survivor lock.
  if (result.is_survivor && result.roles.includes("survivor")) return "survivor" as const;
  if (result.roles.includes("attorney")) {
    if (result.attorney_approved !== false) return "/clients" as const;
    // The unreviewed-attorney intake must not hijack a staff account.
    return result.roles.includes("admin") ? ("/admin" as const) : ("/attorney-apply" as const);
  }
  if (result.roles.includes("advocate"))
    return result.is_org_partner ? ("/org-portal" as const) : ("/advocate-cases" as const);
  throw new Error("No supported portal role was verified.");
}

export async function withAccessTimeout<T>(request: Promise<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Access check timed out.")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
