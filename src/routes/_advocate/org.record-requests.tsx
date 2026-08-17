import { createFileRoute } from "@tanstack/react-router";
import { OrgPilotNotice } from "@/components/org/OrgPilotNotice";

export const Route = createFileRoute("/_advocate/org/record-requests")({
  component: RecordRequests,
});

function RecordRequests() {
  return (
    <>
      <p className="orgx-eyebrow">Records</p>
      <h1 style={{ margin: "8px 0 10px" }}>Record requests</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 640 }}>
        A record request asks one specific person for one specific set of records. They decide whether
        to approve it, and they can withdraw that approval later.
      </p>

      <OrgPilotNotice
        summary="When this opens, a request will carry a stated purpose, a date range, the topic or source type it covers, an expiry date, and whether files may be downloaded at all."
        rules={[
          "A referral never grants record access on its own.",
          "Nothing is shared until the person it belongs to approves that specific request.",
          "Requests expire. An expired or withdrawn request blocks access from that moment on.",
          "Sealed records are never previewed, summarised, processed by AI or exported unless the person unlocks them.",
          "Safety-planning notes stay separate from evidence records and are not included in a record request.",
        ]}
      />
    </>
  );
}
