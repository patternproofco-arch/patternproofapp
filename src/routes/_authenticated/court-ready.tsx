import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /court-ready is retired in favor of /professional-review — kept as a
 * redirect since it's a real, reachable authenticated route and any
 * bookmarked/emailed link to it should keep working.
 */
export const Route = createFileRoute("/_authenticated/court-ready")({
  beforeLoad: () => {
    throw redirect({ to: "/professional-review", replace: true });
  },
});
