import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old "sample case" address was published before the walkthrough moved to
 * /demo, and it returned a dead page. It now sends people straight to the
 * fictional walkthrough so an old link still lands somewhere real.
 */
export const Route = createFileRoute("/sample-case")({
  beforeLoad: () => {
    throw redirect({ to: "/demo" });
  },
});
