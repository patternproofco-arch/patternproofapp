import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_attorney/clients")({
  component: ClientsLayout,
});

function ClientsLayout() {
  // The persistent portal sidebar handles navigation; matters render full-width.
  return <Outlet />;
}
