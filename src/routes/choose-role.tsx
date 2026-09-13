import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/choose-role")({
  head: () => ({
    meta: [
      { title: "PatternProof — Create your account" },
      {
        name: "description",
        content: "Choose how you want to use PatternProof: as a survivor, attorney, or organization.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseRole,
});

function ChooseRole() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      data-portal="survivor"
      data-pp-paper=""
    >
      <PublicQuickExit />
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={76} />
          <p
            className="font-nunito mt-3 text-[15px]"
            style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
          >
            How will you use PatternProof?
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Survivor */}
          <Link
            to="/signup"
            className="card-pp flex flex-col items-center text-center p-6 hover:shadow-md transition-shadow"
            style={{ textDecoration: "none", cursor: "pointer" }}
          >
            <div className="text-[32px] mb-3">📋</div>
            <h3 className="font-serif text-[18px] mb-2">I'm a survivor</h3>
            <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Document incidents and evidence privately. Share only what you choose.
            </p>
          </Link>

          {/* Attorney */}
          <Link
            to="/lawyer-signup"
            className="card-pp flex flex-col items-center text-center p-6 hover:shadow-md transition-shadow"
            style={{ textDecoration: "none", cursor: "pointer" }}
          >
            <div className="text-[32px] mb-3">⚖️</div>
            <h3 className="font-serif text-[18px] mb-2">I'm an attorney</h3>
            <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Build cases from client documentation. Manage your caseload securely.
            </p>
          </Link>

          {/* Organization/Advocate */}
          <Link
            to="/org-signup"
            className="card-pp flex flex-col items-center text-center p-6 hover:shadow-md transition-shadow"
            style={{ textDecoration: "none", cursor: "pointer" }}
          >
            <div className="text-[32px] mb-3">🤝</div>
            <h3 className="font-serif text-[18px] mb-2">I'm an organization</h3>
            <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Print an intake QR. Receive referrals. No cost.
            </p>
          </Link>
        </div>

        <p className="mt-6 text-center text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          Already have an account?{" "}
          <Link to="/signin" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
