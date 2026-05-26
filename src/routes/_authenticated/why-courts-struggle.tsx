import { createFileRoute } from "@tanstack/react-router";
import { WhyCourtsStruggleContent } from "@/components/WhyCourtsStruggleContent";

export const Route = createFileRoute("/_authenticated/why-courts-struggle")({
  component: () => <WhyCourtsStruggleContent />,
});