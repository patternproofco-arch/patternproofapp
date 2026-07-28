import { createFileRoute, redirect } from "@tanstack/react-router";

// Retired route. Old bookmarks land on the homepage instead of a dead end.
export const Route = createFileRoute("/triage")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
