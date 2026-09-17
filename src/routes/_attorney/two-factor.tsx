import { createFileRoute, Link } from "@tanstack/react-router";
import { TwoFactorCard } from "@/components/TwoFactorCard";

export const Route = createFileRoute("/_attorney/two-factor")({
  component: AttorneyTwoFactorPage,
});

function AttorneyTwoFactorPage() {
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 640 }}>
      <div>
        <div className="att-eyebrow">Settings · Sign-in</div>
        <h1 className="att-page-title">Two-factor authentication</h1>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 8, lineHeight: 1.6 }}>
          Shared case files stay closed until an authenticator app is on this account. PatternProof
          does not send codes by text.{" "}
          <Link to="/trust" style={{ color: "var(--att-blue)" }}>
            Back to trust settings
          </Link>
        </p>
      </div>
      <TwoFactorCard className="att-card" headingClassName="att-page-title" required />
    </div>
  );
}
