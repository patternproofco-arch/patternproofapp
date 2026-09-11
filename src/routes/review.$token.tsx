import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short magic-link alias. Recipients do not need an account. */
export const Route = createFileRoute("/review/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/attorney/$token", params: { token: params.token } });
  },
  component: function ReviewAlias() {
    return null;
  },
});
