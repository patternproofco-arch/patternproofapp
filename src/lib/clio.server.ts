/**
 * Server-only Clio Manage OAuth helpers (Authorization Code flow).
 * Tokens never leave the server and are encrypted before storage.
 *
 * NOTE ON AVAILABILITY: the integration stays switched off unless
 * CLIO_INTEGRATION_ENABLED === "true" AND both credentials plus the token
 * encryption key are present. Our Clio application is not approved and Clio
 * currently rejects our credentials at the token endpoint, so the flag stays
 * unset in production. Nothing here claims App Directory approval.
 */
import { decryptToken, encryptToken, tokenEncryptionAvailable } from "@/lib/clio-crypto.server";

const CLIO_AUTHORIZE_URL = "https://app.clio.com/oauth/authorize";
const CLIO_TOKEN_URL = "https://app.clio.com/oauth/token";
const CLIO_DEAUTHORIZE_URL = "https://app.clio.com/oauth/deauthorize";
const CLIO_API_BASE = "https://app.clio.com/api/v4";

/** How long an OAuth state row is valid. Short by design. */
export const STATE_TTL_MS = 10 * 60 * 1000;

// Read inside functions: env is injected per-request in the worker runtime.
export function clioRedirectUri(): string {
  return process.env.CLIO_REDIRECT_URI || "https://pattern-proof.tech/integrations/clio/callback";
}

export interface ClioAvailability {
  available: boolean;
  reason: "ok" | "not_enabled" | "missing_credentials" | "missing_encryption_key";
}

export function clioAvailability(): ClioAvailability {
  if (!process.env.CLIO_CLIENT_ID || !process.env.CLIO_CLIENT_SECRET) {
    return { available: false, reason: "missing_credentials" };
  }
  if (!tokenEncryptionAvailable()) {
    return { available: false, reason: "missing_encryption_key" };
  }
  if (process.env.CLIO_INTEGRATION_ENABLED !== "true") {
    return { available: false, reason: "not_enabled" };
  }
  return { available: true, reason: "ok" };
}

export function assertClioAvailable(): void {
  if (!clioAvailability().available) {
    throw new Error("Clio connection is not available yet.");
  }
}

function credentials() {
  const clientId = process.env.CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Clio connection is not available yet.");
  return { clientId, clientSecret };
}

export function buildClioAuthorizeUrl(state: string): string {
  const { clientId } = credentials();
  const url = new URL(CLIO_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", clioRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const res = await fetch(CLIO_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  if (!res.ok) {
    // Status only — never the body, which can echo the code or a token.
    console.error("[clio] token request rejected with status", res.status);
    throw new Error("Clio didn't accept the connection.");
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) throw new Error("Clio didn't return an access token.");
  return json;
}

export function exchangeCodeForTokens(code: string) {
  return postToken({ grant_type: "authorization_code", code, redirect_uri: clioRedirectUri() });
}

export function refreshTokens(refreshToken: string) {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Best-effort token revocation at Clio. Failure here must not block local deletion. */
export async function revokeClioToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${CLIO_DEAUTHORIZE_URL}?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function expiryFrom(expiresIn?: number): string {
  return new Date(Date.now() + (expiresIn ?? 3600) * 1000).toISOString();
}

export interface ClioIdentity {
  clioUserId: string | null;
  clioUserEmail: string | null;
  firmName: string | null;
}

/**
 * Authenticated who-am-I call. Throws when Clio rejects the token — a
 * connection is only ever marked connected after this succeeds.
 */
export async function fetchClioIdentity(accessToken: string): Promise<ClioIdentity> {
  const res = await fetch(`${CLIO_API_BASE}/users/who_am_i?fields=id,name,email,account{name}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error("[clio] who_am_i failed with status", res.status);
    throw new Error("Clio wouldn't confirm the account for this connection.");
  }
  const json = (await res.json()) as {
    data?: { id?: number | string; email?: string; name?: string; account?: { name?: string } };
  };
  const d = json.data ?? {};
  return {
    clioUserId: d.id != null ? String(d.id) : null,
    clioUserEmail: d.email ?? null,
    firmName: d.account?.name ?? d.name ?? null,
  };
}

/** Persist a token pair for a user, encrypted. */
export async function storeClioTokens(
  userId: string,
  tokens: TokenResponse,
  identity: ClioIdentity,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("clio_connections").upsert(
    {
      user_id: userId,
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token as string),
      expires_at: expiryFrom(tokens.expires_in),
      clio_user_id: identity.clioUserId,
      clio_user_email: identity.clioUserEmail,
      firm_name: identity.firmName,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/**
 * Returns a valid access token for the user, refreshing (and persisting) it
 * when expired. A refresh rejected by Clio marks the connection revoked so the
 * UI stops presenting it as connected.
 */
export async function getValidClioAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("clio_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;

  const expiresSoon = new Date(data.expires_at).getTime() - 60_000 < Date.now();
  if (!expiresSoon) return decryptToken(data.access_token);

  let tokens: TokenResponse;
  try {
    tokens = await refreshTokens(decryptToken(data.refresh_token));
  } catch {
    await supabaseAdmin
      .from("clio_connections")
      .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return null;
  }

  await supabaseAdmin
    .from("clio_connections")
    .update({
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token ?? decryptToken(data.refresh_token)),
      expires_at: expiryFrom(tokens.expires_in),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return tokens.access_token;
}
