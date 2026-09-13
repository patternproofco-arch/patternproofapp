import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";

export const Route = createFileRoute("/_authenticated/password")({
  head: () => ({
    meta: [
      { title: "Change password — PatternProof" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PasswordPage,
});

function PasswordPage() {
  return (
    <div>
      <div className="label-eyebrow">Settings</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Account <em>password.</em>
      </h1>
      <p className="mt-2 mb-6 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        This is the password you use to sign in. It is separate from the app PIN.
      </p>
      <ChangePasswordCard />
    </div>
  );
}
