import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /court-ready previously hosted the optional-contribution flow. Preserve
 * existing internal and external links while the product-facing route uses
 * the clearer /contribute name.
 */
export const Route = createFileRoute("/_authenticated/court-ready")({
  beforeLoad: () => {
    throw redirect({ to: "/contribute", replace: true });
  },
});
