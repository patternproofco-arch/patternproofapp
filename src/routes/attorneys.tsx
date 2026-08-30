import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /attorneys is a legacy short alias. /for-attorneys is the canonical
 * attorney marketing page, so forward permanently instead of keeping a
 * second attorney-facing entry point alive.
 */
export const Route = createFileRoute("/attorneys")({
  beforeLoad: () => {
    throw redirect({ to: "/for-attorneys", replace: true });
  },
});
