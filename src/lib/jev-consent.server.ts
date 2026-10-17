import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AttorneyLink } from "./attorney-access.server";
import { jevFingerprint } from "./jev-retrieval.server";
import { z } from "zod";
export const JEV_CONSENT_VERSION = "typesafe-request-matching-v1";
export const JEV_CONSENT_REQUIRED =
  "The survivor hasn't authorized Jev checks for this current share. You can review the shared files manually.";
export const JEV_CONSENT_DAYS = 30;
export const consentKey = (linkId: string) => `jev_request_access_${linkId}`;
const permissionSchema = z.object({
  version: z.literal(JEV_CONSENT_VERSION),
  clientId: z.string(),
  attorneyId: z.string(),
  scopeHash: z.string(),
  nonce: z.string(),
  expiresAt: z.string().datetime(),
});
export type JevPermission = z.infer<typeof permissionSchema>;
export function jevScopeHash(link: AttorneyLink) {
  return jevFingerprint({
    grantId: link.id,
    caseId: link.case_id ?? null,
    files: [...new Set(link.scope_evidence ?? [])].sort(),
  });
}
export async function permissionFromMetadata(
  metadata: Record<string, unknown>,
  clientId: string,
  attorneyId: string,
  link: AttorneyLink,
): Promise<JevPermission | null> {
  const parsed = permissionSchema.safeParse(metadata[consentKey(link.id)]);
  if (
    !parsed.success ||
    parsed.data.clientId !== clientId ||
    parsed.data.attorneyId !== attorneyId ||
    Date.parse(parsed.data.expiresAt) <= Date.now() ||
    parsed.data.scopeHash !== (await jevScopeHash(link))
  )
    return null;
  return parsed.data;
}
export async function readJevPermission(
  db: SupabaseClient<Database>,
  clientId: string,
  attorneyId: string,
  link: AttorneyLink,
) {
  const { data, error } = await db.auth.admin.getUserById(clientId);
  if (error || !data?.user) throw new Error(JEV_CONSENT_REQUIRED);
  const permission = await permissionFromMetadata(
    data.user.app_metadata ?? {},
    clientId,
    attorneyId,
    link,
  );
  if (!permission) throw new Error(JEV_CONSENT_REQUIRED);
  return permission;
}

/** Authenticated session events only. JWT issue/refresh and account-wide sign-in are not user presence. */
export function hasRecentJevAuthentication(claims: { amr?: unknown }, now = Date.now()) {
  const times = Array.isArray(claims.amr)
    ? claims.amr.flatMap((event) =>
        event &&
        typeof event === "object" &&
        "method" in event &&
        "timestamp" in event &&
        ["oauth", "otp", "password", "magiclink", "totp", "webauthn"].includes(
          String(event.method),
        ) &&
        typeof event.timestamp === "number"
          ? [event.timestamp * 1000]
          : [],
      )
    : [];
  const authenticatedAt = Math.max(0, ...times);
  return authenticatedAt > 0 && now >= authenticatedAt && now - authenticatedAt <= 10 * 60_000;
}
