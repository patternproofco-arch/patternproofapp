import { createFileRoute, redirect } from "@tanstack/react-router";

/*
 * One staff dashboard. /admin used to show a second copy of the attorney
 * approval list (the earlier Lovable form). Approvals now live in one place,
 * /admin/operations, so there is a single approval list to trust.
 */
export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/operations" });
  },
});
