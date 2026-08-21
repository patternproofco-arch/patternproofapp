import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /login is retired in favor of /signin + /signup, but partner referral
 * links (e.g. https://pattern-proof.tech/login?ref=bff) are already out in
 * the world — this redirect forwards ref and redirect through unchanged so
 * an existing link keeps attributing correctly forever.
 */
export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => {
    const out: { redirect?: string; ref?: string } = {};
    if (typeof s.redirect === "string") out.redirect = s.redirect;
    if (typeof s.ref === "string") out.ref = s.ref;
    return out;
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/signin", search, replace: true });
  },
});
