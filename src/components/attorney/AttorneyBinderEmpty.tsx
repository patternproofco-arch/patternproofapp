import { Link } from "@tanstack/react-router";

/**
 * Soft CLEAR attorney binder empty / revoked honesty.
 * Never upload-for-client. Navy dense; no iridescent.
 */
export function AttorneyBinderEmpty({
  variant,
  clientId,
  hasMessaging,
}: {
  variant: "nothing_shared" | "notes_not_files" | "access_ended";
  clientId: string;
  hasMessaging?: boolean;
}) {
  if (variant === "access_ended") {
    return (
      <div
        className="att-card"
        data-testid="attorney-binder-empty"
        style={{ borderLeft: "4px solid var(--att-slate)", padding: 20 }}
      >
        <div className="att-eyebrow">Access ended</div>
        <h2 style={{ fontSize: 18, margin: "6px 0 8px", fontFamily: "var(--font-sans)" }}>
          They ended access
        </h2>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", lineHeight: 1.5 }}>
          Your client withdrew access, or a share expired. Nothing from them is available here now.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link to="/clients" className="att-btn-secondary" style={{ fontSize: 13 }}>
            Back to clients
          </Link>
        </div>
      </div>
    );
  }

  if (variant === "notes_not_files") {
    return (
      <div
        className="att-card"
        data-testid="attorney-binder-empty"
        style={{ borderLeft: "4px solid var(--att-navy)", padding: 20 }}
      >
        <div className="att-eyebrow">Shared notes</div>
        <h2 style={{ fontSize: 18, margin: "6px 0 8px", fontFamily: "var(--font-sans)" }}>
          Notes are here. Files weren’t included in what they shared.
        </h2>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", lineHeight: 1.5 }}>
          That doesn’t mean something’s wrong — they choose what to include.
        </p>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hasMessaging ? (
            <Link
              to="/clients/$clientId"
              params={{ clientId }}
              className="att-btn-primary"
              style={{ fontSize: 13 }}
            >
              Request materials
            </Link>
          ) : null}
          <Link to="/clients" className="att-btn-secondary" style={{ fontSize: 13 }}>
            Back to clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="att-card"
      data-testid="attorney-binder-empty"
      style={{ borderLeft: "4px solid var(--att-navy)", padding: 20 }}
    >
      <div className="att-eyebrow">Binder</div>
      <h2 style={{ fontSize: 18, margin: "6px 0 8px", fontFamily: "var(--font-sans)" }}>
        Nothing shared with you yet
      </h2>
      <p style={{ fontSize: 13, color: "var(--att-text-2)", lineHeight: 1.5 }}>
        Your client hasn’t shared files here. That doesn’t mean something’s wrong — they choose what
        to include.
      </p>
      <p style={{ fontSize: 12, color: "var(--att-muted)", marginTop: 8, lineHeight: 1.45 }}>
        If you’re waiting on something specific, you can send a short ask — they stay in control.
      </p>
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {hasMessaging ? (
          <Link
            to="/clients/$clientId"
            params={{ clientId }}
            className="att-btn-primary"
            style={{ fontSize: 13 }}
          >
            Request materials
          </Link>
        ) : (
          <Link
            to="/clients/$clientId"
            params={{ clientId }}
            className="att-btn-primary"
            style={{ fontSize: 13 }}
          >
            Back to client
          </Link>
        )}
        <Link to="/clients" className="att-btn-secondary" style={{ fontSize: 13 }}>
          Back to clients
        </Link>
      </div>
    </div>
  );
}
