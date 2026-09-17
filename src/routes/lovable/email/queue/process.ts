import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { drainEmailQueues } from "@/lib/email-queue-drain.server";

export const Route = createFileRoute("/lovable/email/queue/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
          const missing = [
            !apiKey && "LOVABLE_API_KEY",
            !supabaseUrl && "SUPABASE_URL",
            !supabaseServiceKey && "SUPABASE_SERVICE_ROLE_KEY",
          ].filter(Boolean);
          console.error(`Missing required environment variables: ${missing.join(", ")}`);
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Verify the caller is authorized with the service role key.
        // This endpoint is a manual/retry-only path — emails normally send
        // synchronously right after enqueue (see email-queue-drain.server.ts).
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length).trim();
        if (token !== supabaseServiceKey) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const supabase: SupabaseClient<any, any> = createClient(supabaseUrl, supabaseServiceKey);
        const result = await drainEmailQueues(supabase, apiKey, process.env.LOVABLE_SEND_URL);
        return Response.json(result);
      },
    },
  },
});
