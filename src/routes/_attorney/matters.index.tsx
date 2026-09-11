import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createMatter, listMatters } from "@/lib/matters.functions";
import { folio } from "@/components/pp/folio";

export const Route = createFileRoute("/_attorney/matters/")({
  head: () => ({
    meta: [
      { title: "Matters — PatternProof" },
      {
        name: "description",
        content: "Open and keep firm matters, and attach a client's shared file to each one.",
      },
      { property: "og:title", content: "Matters — PatternProof" },
      {
        property: "og:description",
        content: "Open and keep firm matters, and attach a client's shared file to each one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MattersIndex,
});

type Data = Awaited<ReturnType<typeof listMatters>>;

function MattersIndex() {
  const list = useServerFn(listMatters);
  const create = useServerFn(createMatter);
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(
    () =>
      list()
        .then(setData)
        .catch(() => toast("We couldn't load your matters. Try again in a moment.")),
    [list],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const matter_name = String(f.get("matter_name") ?? "").trim();
    if (!matter_name) return;
    setSaving(true);
    try {
      await create({
        data: {
          matter_name,
          matter_number: String(f.get("matter_number") ?? "") || null,
          case_type: String(f.get("case_type") ?? "") || null,
          court: String(f.get("court") ?? "") || null,
          jurisdiction: String(f.get("jurisdiction") ?? "") || null,
          client_link_id: String(f.get("client_link_id") ?? "") || null,
        },
      });
      setOpen(false);
      await reload();
      toast("Matter opened. It's saved to your firm.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "We couldn't open that matter. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={folio.page}>
      <div style={folio.eyebrow}>Firm records</div>
      <h1 style={folio.h1}>Matters</h1>
      <p style={folio.lede}>
        A matter is your own record of a case. Attach a client's shared file when they've shared one
        with you, and assign an advocate to a single matter at a time.
      </p>

      {!open && (
        <button type="button" style={folio.btn} onClick={() => setOpen(true)}>
          Open a matter
        </button>
      )}

      {open && (
        <form onSubmit={submit} style={{ ...folio.card, display: "grid", gap: 14, maxWidth: 640 }}>
          <h2 style={folio.h2}>Open a matter</h2>
          <Field label="Matter name" name="matter_name" required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Matter number" name="matter_number" />
            <Field label="Case type" name="case_type" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Court" name="court" />
            <Field label="Jurisdiction" name="jurisdiction" />
          </div>
          <div>
            <label style={folio.label} htmlFor="client_link_id">
              Client's shared file (optional)
            </label>
            <select id="client_link_id" name="client_link_id" style={folio.input}>
              <option value="">Not attached yet</option>
              {(data?.links ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  Client {l.client_user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" style={folio.btn} disabled={saving}>
              {saving ? "Saving…" : "Open matter"}
            </button>
            <button type="button" style={folio.btnQuiet} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <hr style={folio.rule} />

      {data === null && <p style={folio.lede}>Loading your matters…</p>}
      {data && data.matters.length === 0 && (
        <p style={folio.lede}>
          No matters yet — when you're ready, open one and the rest follows from there.
        </p>
      )}

      <div style={{ display: "grid", gap: 0 }}>
        {(data?.matters ?? []).map((m) => (
          <Link
            key={m.id}
            to="/matters/$matterId"
            params={{ matterId: m.id }}
            style={{
              display: "grid",
              gap: 4,
              padding: "16px 0",
              borderTop: "1px solid var(--rule)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <div style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 18 }}>
              {m.matter_name}
            </div>
            <div style={folio.mono}>
              {[
                m.matter_number ? `No. ${m.matter_number}` : null,
                m.case_type,
                m.court,
                m.jurisdiction,
                m.status === "closed" ? "Closed" : "Open",
                m.client_link_id ? "Client file attached" : "No client file yet",
                `${m.advocate_count} advocate${m.advocate_count === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Field({ label, name, required }: { label: string; name: string; required?: boolean }) {
  return (
    <div>
      <label style={folio.label} htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} required={required} style={folio.input} />
    </div>
  );
}
