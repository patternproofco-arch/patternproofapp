import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { applyAsAttorney, type AttorneyApplication } from "@/lib/founder-operations.functions";

interface InviteApprovalStepProps {
  application: AttorneyApplication | null;
  draft: { fullName: string; barNumber: string };
  onSubmitted: () => void;
}

/**
 * Shown to a signed-in invited attorney who is not yet approved. Files the
 * approval application in place (so the invite journey never dead-ends) and
 * explains the hold while the founder reviews it. Acceptance itself stays
 * server-gated on approval; this screen only changes what the attorney sees.
 */
export function InviteApprovalStep({ application, draft, onSubmitted }: InviteApprovalStepProps) {
  const apply = useServerFn(applyAsAttorney);
  const [fullName, setFullName] = useState(draft.fullName);
  const [barNumber, setBarNumber] = useState(draft.barNumber);
  const [firm, setFirm] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (application?.status === "pending_review") {
    return (
      <div className="att-card" style={{ textAlign: "center" }}>
        <ShieldCheck size={28} style={{ color: "var(--att-green)", margin: "0 auto 8px" }} />
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Your access is being reviewed</h2>
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
          We check every attorney's bar number before any client file opens. Come back to this
          same link once you're approved — your client's invitation is held here for you.
        </p>
      </div>
    );
  }
  if (application?.status === "rejected") {
    return (
      <div className="att-card">
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>We couldn't approve this account</h2>
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
          This case file stays closed. Reply to your review email if you think this is a mistake.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await apply({
        data: { full_name: fullName, firm_name: firm, bar_number: barNumber, jurisdiction },
      });
      onSubmitted();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "We couldn't send that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, req = true) => (
    <div>
      <label className="att-eyebrow" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="att-input"
        required={req}
        value={value}
        onChange={(e) => set(e.target.value)}
        style={{ marginTop: 4 }}
      />
    </div>
  );

  return (
    <div className="att-card">
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>One step before the file opens</h2>
      <p style={{ fontSize: 12, color: "var(--att-text-2)", marginBottom: 16 }}>
        PatternProof reviews each attorney before a client's records can be opened. Your client's
        invitation stays here while we review.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {field("invite-apply-name", "Full name", fullName, setFullName)}
        {field("invite-apply-firm", "Firm (optional)", firm, setFirm, false)}
        {field("invite-apply-bar", "Bar number", barNumber, setBarNumber)}
        {field("invite-apply-jurisdiction", "State / jurisdiction", jurisdiction, setJurisdiction)}
        {message && <p style={{ fontSize: 12, color: "var(--att-text-2)" }}>{message}</p>}
        <button className="att-btn-primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "One moment…" : "Send for review"}
        </button>
      </form>
    </div>
  );
}
