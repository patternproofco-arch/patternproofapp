import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { submitOrgAccessRequest } from "@/lib/org-portal.functions";

export const Route = createFileRoute("/partner-access")({
  head: () => ({
    meta: [
      { title: "Organization signup — PatternProof" },
      {
        name: "description",
        content:
          "Domestic violence organizations can create a PatternProof account. Survivors keep the file.",
      },
    ],
  }),
  component: PartnerAccess,
});

const ORG_TYPES = [
  "Domestic violence shelter or program",
  "Sexual assault or crisis center",
  "Legal aid organization",
  "Court-based advocacy program",
  "Community or faith-based organization",
  "Other",
];

function PartnerAccess() {
  const submit = useServerFn(submitOrgAccessRequest);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const perMonth = String(f.get("survivors_per_month") ?? "").trim();
    setSaving(true);
    setError(null);
    try {
      const r = await submit({
        data: {
          org_name: String(f.get("org_name") ?? ""),
          website: String(f.get("website") ?? "") || null,
          contact_name: String(f.get("contact_name") ?? ""),
          email: String(f.get("email") ?? ""),
          contact_role: String(f.get("contact_role") ?? ""),
          phone: String(f.get("phone") ?? "") || null,
          service_area: String(f.get("service_area") ?? ""),
          org_type: String(f.get("org_type") ?? ""),
          message: String(f.get("message") ?? ""),
          survivors_per_month: perMonth ? Number(perMonth) : null,
          contact_consent: true,
        },
      });
      setDone(r.message);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't send that just now. Try again in a moment.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-pp-paper="" className="pp-public-shell folio-page min-h-screen px-4 py-10">
      <PublicQuickExit />
      <div className="mx-auto w-full max-w-[640px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={72} variant="advocate" />
          <h1 className="font-serif text-[28px] font-bold mt-3">Create an organization account</h1>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Tell us about your organization. Print the intake QR at /intake. Survivors keep the
            file. A person reads every form.
          </p>
        </div>

        {done ? (
          <div className="card-pp text-center">
            <h2 className="font-serif text-[20px]">Received</h2>
            <p className="mt-2 text-[13.5px]">{done}</p>
            <Link to="/org-signup" className="btn-primary mt-5 inline-flex">
              Or create an account now
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card-pp space-y-3">
            <Field label="Organization name" name="org_name" required />
            <Field label="Website (optional)" name="website" placeholder="https://" />
            <Field label="Your full name" name="contact_name" required />
            <Field label="Work email" name="email" type="email" required />
            <Field label="Your role or title" name="contact_role" required />
            <Field label="Phone (optional)" name="phone" />
            <Field label="Service area (state or region)" name="service_area" required placeholder="e.g. New Jersey" />
            <label className="block text-[12.5px] font-semibold">
              Organization type
              <select name="org_type" required className="input-pp mt-1" defaultValue="">
                <option value="" disabled>
                  Choose one
                </option>
                {ORG_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Survivors you support in a typical month (optional)" name="survivors_per_month" type="number" />
            <label className="block text-[12.5px] font-semibold">
              How would your team use PatternProof?
              <textarea name="message" required minLength={10} maxLength={2000} rows={4} className="input-pp mt-1" />
            </label>
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="checkbox" required className="mt-[3px]" name="contact_consent" />
              <span>It is okay to contact me at this work email about this form.</span>
            </label>
            {error && <p className="text-[12.5px]">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-[12.5px] font-semibold">
      {label}
      <input className="input-pp mt-1" name={name} type={type} required={required} placeholder={placeholder} />
    </label>
  );
}
