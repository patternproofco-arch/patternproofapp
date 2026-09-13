import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminSendPasswordReset } from "@/lib/password.functions";

export const Route = createFileRoute("/_authenticated/admin/password-reset")({
  head: () => ({
    meta: [
      { title: "Send password reset — PatternProof" },
      {
        name: "description",
        content: "Send a password-reset email to a PatternProof account.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPasswordReset,
});

function AdminPasswordReset() {
  const sendFn = useServerFn(adminSendPasswordReset);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await sendFn({ data: { email: email.trim() } });
      toast("Reset email sent — they choose the new password themselves.");
      setEmail("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "We couldn't send that reset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 20px", display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: 0 }}>
          Send a password reset
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
          We never put a password in the email. The person gets a one-time link that opens a page
          where they choose a new password. The link expires in 24 hours.
        </p>
      </div>

      <form onSubmit={submit} className="card-pp" style={{ display: "grid", gap: 10 }}>
        <label className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Account email
        </label>
        <input
          className="input-pp"
          type="email"
          required
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}
