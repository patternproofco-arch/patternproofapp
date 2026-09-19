import { createFileRoute } from "@tanstack/react-router";
import { buildAttorneyResource } from "@/lib/attorney-kit.server";
export const Route = createFileRoute("/resources/attorney-kit")({
  server: {
    handlers: {
      GET: async () =>
        new Response(new Uint8Array(await buildAttorneyResource()), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="PatternProof_Attorney_Intake_Kit.pdf"',
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        }),
    },
  },
});
