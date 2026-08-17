import { createFileRoute } from "@tanstack/react-router";
import { OrgPilotNotice } from "@/components/org/OrgPilotNotice";

export const Route = createFileRoute("/_advocate/org/follow-ups")({
  component: FollowUps,
});

function FollowUps() {
  return (
    <>
      <p className="orgx-eyebrow">Coordination</p>
      <h1 style={{ margin: "8px 0 10px" }}>Follow-ups and warm handoffs</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 660 }}>
        A place to keep track of a handoff you have offered — whether it was accepted, scheduled,
        completed or declined — with a due date and a neutral note.
      </p>

      <OrgPilotNotice
        summary="When this opens, each handoff will carry a status, a due date and a short factual note written by your team."
        rules={[
          "Notes here are for coordination. They are not part of anyone's evidence record and are not exported to a professional packet.",
          "A handoff does not move records. Records only move through an approved request.",
          "Wording stays neutral, and notifications will not repeat sensitive detail.",
        ]}
      />
    </>
  );
}
