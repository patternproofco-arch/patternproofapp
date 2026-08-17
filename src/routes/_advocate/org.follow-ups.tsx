import { createFileRoute } from "@tanstack/react-router";
import { OrgPilotNotice } from "@/components/org/OrgPilotNotice";

export const Route = createFileRoute("/_advocate/org/follow-ups")({
  component: FollowUps;
});
