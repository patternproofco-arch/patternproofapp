import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/partner-home")({
  head: () => ({
    meta: [
      { title: "PatternProof — Partner Dashboard" },
      {
        name: "description",
        content: "Your organization's referral dashboard. Print an intake QR, see referrals, and manage your team.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerHome,
});

function PartnerHome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/signin", replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div data-pp-paper="" className="min-h-screen px-5 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size={48} variant="advocate" />
            <h1 className="font-serif text-[32px] font-bold">Partner Dashboard</h1>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* QR Code Card */}
          <div className="card-pp p-6 md:col-span-1">
            <h2 className="font-serif text-[18px] mb-2">Intake QR</h2>
            <p className="text-[13px] mb-4" style={{ color: "var(--muted-foreground)" }}>
              Print this QR for survivors to join and share their documentation.
            </p>
            <div className="flex items-center justify-center bg-gray-100 rounded p-4 h-48">
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                QR code coming soon
              </p>
            </div>
          </div>

          {/* Info Card */}
          <div className="card-pp p-6 md:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-serif text-[18px] mb-2">Your referral kit</h2>
                <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Share your intake QR code with survivors. You&apos;ll see referrals arrive here when they
                  document with PatternProof and choose to share with your organization.
                </p>
              </div>
              <div
                className="px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--muted-foreground)",
                  color: "var(--background)",
                }}
              >
                Unverified
              </div>
            </div>

            <div className="mt-4 p-3 rounded text-[12px]" style={{ background: "var(--muted)" }}>
              <p style={{ color: "var(--muted-foreground)" }}>
                <strong>Note:</strong> Your organization is currently unverified. Survivors can still share
                their documentation with you, and they control what you see. We verify organizations
                periodically — you&apos;ll get a verified badge when we complete that check.
              </p>
            </div>
          </div>
        </div>

        {/* Verification Form Stub */}
        <div className="card-pp p-6 mt-6">
          <h2 className="font-serif text-[18px] mb-4">Organization verification (optional)</h2>
          <p className="text-[13px] mb-4" style={{ color: "var(--muted-foreground)" }}>
            Help us verify your organization. This is optional and doesn&apos;t affect how survivors share
            with you.
          </p>
          <button
            disabled
            className="btn-primary"
            style={{ opacity: 0.55 }}
          >
            Verification form coming soon
          </button>
        </div>

        {/* Referrals Shell */}
        <div className="card-pp p-6 mt-6">
          <h2 className="font-serif text-[18px] mb-4">Referrals</h2>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Survivors who use your intake QR and share with you will appear here.
          </p>
          <div className="mt-4 text-center p-8" style={{ background: "var(--muted)", borderRadius: "8px" }}>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              No referrals yet. Print and share your intake QR to get started.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
