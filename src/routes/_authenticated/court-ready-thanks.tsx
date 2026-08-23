import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /court-ready-thanks is retired in favor of /professional-review-thanks.
 * Stripe checkout returnUrls generated before this rename may still point
 * here, so this preserves ?session_id and forwards it through.
 */
export const Route = createFileRoute("/_authenticated/court-ready-thanks")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/professional-review-thanks", search, replace: true });
  },
});
