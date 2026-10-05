import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prep/modules")({
  component: () => <Outlet />,
});
