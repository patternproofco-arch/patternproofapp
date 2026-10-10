import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { submitAttorneyApplication } from "@/lib/founder-ops.functions";

export const Route = createFileRoute("/attorney-apply")({
  head: () => ({
    meta: [
      { title: "Request attorney access — PatternProof" },
      { name: "description", content: "Attorneys can request access to PatternProof. Each request is reviewed by a person before access opens." },
      { property: "og:title", content: "Request attorney access — PatternProof" },
      { property: "og:description", content: "Each attorney request is reviewed by a person before access opens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttorneyApply,
});

function AttorneyApply() {
  const submit = useServerFn(submitAttorneyApplication);
  const [f, setF] = useState({ full_name: "", email: "", firm_name: "", bar_number: "", jurisdiction: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await submit({ data: f });
      setDone(true);
    } catch {
      setErr("We couldn't send that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <PublicQuickExit />
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={64} variant="attorney" />
          <h1 className="font-serif text-[26px] font-bold mt-3">Request attorney access</h1>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            A person reviews every request. Nothing opens until it's approved, and you'll only ever see what a client chooses to share.
          </p>
        </div>
        {done ? (
          <div className="card-pp">
            <p className="text-[15px]">Thank you. Your request is in. Once it's approved, you'll get an email to set up your sign-in.</p>
          </div>
        ) : (
          <form className="card-pp space-y-3" onSubmit={onSubmit}>
            <input className="input-pp" aria-label="Full name" placeholder="Full name" required value={f.full_name} onChange={set("full_name")} />
            <input className="input-pp" aria-label="Work email" type="email" autoComplete="email" placeholder="Work email" required value={f.email} onChange={set("email")} />
            <input className="input-pp" aria-label="Firm (optional)" placeholder="Firm (optional)" value={f.firm_name} onChange={set("firm_name")} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input-pp" aria-label="Bar number" placeholder="Bar number" value={f.bar_number} onChange={set("bar_number")} />
              <input className="input-pp" aria-label="State" placeholder="State" value={f.jurisdiction} onChange={set("jurisdiction")} />
            </div>
            <textarea className="input-pp" aria-label="Anything we should know (optional)" placeholder="Anything we should know (optional). Please don't include client details." rows={3} maxLength={1000} value={f.note} onChange={set("note")} />
            {err ? <p className="text-[13px]">{err}</p> : null}
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send my request"}</button>
          </form>
        )}
        <p className="mt-4 text-center text-[13px]">
          Already approved? <Link to="/lawyer-signup">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
