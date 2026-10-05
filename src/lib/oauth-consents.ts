import { supabase } from "@/integrations/supabase/client";

export interface ConsentRow {
  client_id: string;
  client_name: string;
  scopes: string[];
  granted_at: string;
}

/** Auth binds these operations to the current browser session, not a supplied user ID. */
export async function listMyOauthConsents(): Promise<ConsentRow[]> {
  const { data, error } = await supabase.auth.oauth.listGrants();
  if (error || !Array.isArray(data)) {
    throw new Error("We couldn't load your connected apps. Try again in a moment.");
  }
  return data.map((grant) => ({
    client_id: grant.client.id,
    client_name: grant.client.name,
    scopes: grant.scopes,
    granted_at: grant.granted_at,
  }));
}

/** The Auth API also invalidates the client's sessions and refresh tokens. */
export async function revokeMyOauthConsent(clientId: string): Promise<void> {
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) throw new Error("We couldn't turn off that connection. Try again in a moment.");
}
