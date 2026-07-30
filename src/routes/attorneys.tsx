import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short alias: /attorneys → homepage in attorney-referral mode. */
export const Route = createFileRoute("/attorneys")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: { ref: "attorney" }, replace: true });
  },
});
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/attorneys')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/attorneys"!</div>
}
