import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sample-case")({
  beforeLoad: () => {
    throw redirect({ to: "/demo", replace: true });
  },
});
