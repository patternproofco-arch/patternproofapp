import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility alias for previously shared attorney billing links. The
 * renamed route retains the same logged-time information under clearer copy.
 */
export const Route = createFileRoute("/_authenticated/attorney-billing")({
  beforeLoad: () => {
    throw redirect({ to: "/attorney-time-log", replace: true });
  },
});
