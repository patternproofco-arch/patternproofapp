import { createFileRoute } from "@tanstack/react-router";
const headers = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export const Route = createFileRoute("/email/attorney-followups")({
  server: {
    handlers: {
      // Link scanners only see a form. GET never opts an address into marketing.
      GET: async () =>
        new Response(
          '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Confirm PatternProof follow-ups</title><main style="max-width:580px;margin:60px auto;padding:24px;font:18px/1.6 system-ui"><h1>Would you like four attorney workflow emails?</h1><p>Your kit is already yours. Confirm only if you want the optional follow-ups over the next 14 days. You can unsubscribe at any time.</p><form method="post"><button type="submit">Confirm follow-ups</button></form></main></html>',
          { headers },
        ),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin)
          return new Response("Invalid origin", { status: 403 });
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { confirmNurture } = await import("@/lib/attorney-nurture.server");
        const ok = await confirmNurture(supabaseAdmin, token);
        return new Response(
          ok
            ? "Follow-ups confirmed. You can unsubscribe from any email."
            : "This confirmation is unavailable, expired, or already used. Your kit is still available.",
          {
            status: ok ? 200 : 400,
            headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
          },
        );
      },
    },
  },
});
