import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility alias for pre-rename contribution return URLs. The active
 * contribution flow now uses the clearer `/contribute-thanks` path.
 */
export const Route = createFileRoute("/_authenticated/court-ready-thanks")({
  validateSearch: (s: Record<string, unknown>) => {
    const out: { session_id?: string } = {};
    if (typeof s.session_id === "string") out.session_id = s.session_id;
    return out;
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/contribute-thanks", search, replace: true });
  },
});
