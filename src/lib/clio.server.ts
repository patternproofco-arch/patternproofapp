// Server-only Clio OAuth helpers. Tokens never leave the server.
const CLIO_AUTHORIZE_URL = "https://app.clio.com/oauth/authorize";
const CLIO_TOKEN_URL = "https://app.clio.com/oauth/token";
const CLIO_API_BASE = "https://app.clio.com/api/v4";

// Read inside functions: env is injected per-request in the worker runtime.
export function clioRedirectUri(): string {
  return process.env.CLIO_REDIRECT_URI || "https://pattern-proof.tech/integrations/clio/callback";
}

function credentials() {
  const clientId = process.env.CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Clio isn't set up yet. Add CLIO_CLIENT_ID and CLIO_CLIENT_SECRET in Project Settings → Secrets.");
  }
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
    console.error("[clio] token request failed", res.status, await res.text().catch(() => ""));
    throw new Error("Clio didn't accept the connection. Try connecting again in a moment.");
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCodeForTokens(code: string) {
  return postToken({ grant_type: "authorization_code", code, redirect_uri: clioRedirectUri() });
}

export function refreshTokens(refreshToken: string) {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export function expiryFrom(expiresIn?: number): string {
  return new Date(Date.now() + (expiresIn ?? 3600) * 1000).toISOString();
}

export interface ClioIdentity {
  clioUserId: string | null;
  clioUserEmail: string | null;
  firmName: string | null;
}

export async function fetchClioIdentity(accessToken: string): Promise<ClioIdentity> {
  try {
    const res = await fetch(`${CLIO_API_BASE}/users/who_am_i?fields=id,name,email,account{name}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { clioUserId: null, clioUserEmail: null, firmName: null };
    const json = (await res.json()) as {
      data?: { id?: number | string; email?: string; name?: string; account?: { name?: string } };
    };
    const d = json.data ?? {};
    return {
      clioUserId: d.id != null ? String(d.id) : null,
      clioUserEmail: d.email ?? null,
      firmName: d.account?.name ?? d.name ?? null,
    };
  } catch {
    return { clioUserId: null, clioUserEmail: null, firmName: null };
  }
}

/** Returns a valid access token for the user, refreshing (and persisting) it when expired. */
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
  if (!expiresSoon) return data.access_token;

  const tokens = await refreshTokens(data.refresh_token);
  await supabaseAdmin
    .from("clio_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? data.refresh_token,
      expires_at: expiryFrom(tokens.expires_in),
    })
    .eq("user_id", userId);
  return tokens.access_token;
}
