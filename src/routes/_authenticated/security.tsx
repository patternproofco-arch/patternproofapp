import { createFileRoute, Link } from "@tanstack/react-router";
import { TwoFactorCard } from "@/components/TwoFactorCard";

export const Route = createFileRoute("/_authenticated/security")({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div>
      <div className="label-eyebrow">Account</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Sign-in security
      </h1>
      <p className="mt-2 max-w-xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        An authenticator app is the extra lock on this account. PatternProof never sends codes by
        text message.{" "}
        <Link to="/settings" style={{ color: "var(--accent)", textDecoration: "underline" }}>
          Back to settings
        </Link>
      </p>
      <TwoFactorCard />
    </div>
  );
}
