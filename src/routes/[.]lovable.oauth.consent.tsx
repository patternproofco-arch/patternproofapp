import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppMark } from "@/components/brand/AppMark";

// Supabase's auth.oauth namespace is beta — narrow the surface we use so
// TypeScript is happy without pulling internals.
type OAuthDetails = {
  client?: { name?: string; client_id?: string; redirect_uri?: string } | null;
  scopes?: string[] | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md card-pp">
        <h1 className="font-serif text-xl mb-2">We couldn't load this request</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData() as OAuthDetails | null;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an app";
  const redirectUri = details?.client?.redirect_uri;
  const scopes = details?.scopes ?? [];

  async function decide(approve: boolean) {
    setBusy(true);
    setErrorMsg(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setErrorMsg(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setErrorMsg("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md card-pp">
        <div className="flex flex-col items-center text-center mb-5">
          <AppMark size={58} />
          <h1 className="font-serif text-[22px] mt-3">
            Connect <span className="italic">{clientName}</span> to PatternProof
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>
            This lets {clientName} act as you in PatternProof — reading and writing only your
            own private case data.
          </p>
        </div>

        <div className="rounded-xl p-4 mb-4 text-sm space-y-2"
             style={{ background: "var(--muted, #DEB896)", color: "#2A1A10" }}>
          <div><strong>What this app will be able to do:</strong></div>
          <ul className="list-disc pl-5 space-y-1">
            <li>See your documented incidents</li>
            <li>See your evidence items</li>
            <li>Log new incidents on your behalf</li>
            <li>Search across your private case</li>
          </ul>
          {redirectUri && (
            <div className="pt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Redirect: {redirectUri}
            </div>
          )}
          {scopes.length > 0 && (
            <div className="pt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Requested: {scopes.join(", ")}
            </div>
          )}
        </div>

        <p className="text-[12px] mb-4" style={{ color: "var(--muted-foreground)" }}>
          You can revoke access anytime from your account settings. This does not bypass
          PatternProof's permissions — the app can only see what you can see.
        </p>

        {errorMsg && (
          <p role="alert" className="text-sm mb-3" style={{ color: "#9B2C3E" }}>{errorMsg}</p>
        )}

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            disabled={busy}
            onClick={() => decide(true)}
          >
            {busy ? "One moment…" : "Approve"}
          </button>
          <button
            className="input-pp flex-1"
            style={{ background: "transparent" }}
            disabled={busy}
            onClick={() => decide(false)}
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}