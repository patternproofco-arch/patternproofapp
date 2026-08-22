import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Printer, AlertTriangle } from "lucide-react";
import { fetchSharedBundle } from "@/lib/attorney-public.functions";
import { typeLabel } from "@/lib/abuse-types";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/attorney/$token")({
  head: ({ params }) => ({
    meta: [
      { title: "Shared case bundle — PatternProof" },
      { name: "description", content: "Read-only attorney access to a case bundle shared by a PatternProof user." },
      { property: "og:title", content: "Shared case bundle — PatternProof" },
      { property: "og:description", content: "Private, time-limited access to a survivor's case documentation." },
      { property: "og:url", content: `https://project--f496a23a-1a8f-408f-b5e0-e96d5947d49c.lovable.app/attorney/${params.token}` },
      { name: "twitter:title", content: "Shared case bundle — PatternProof" },
      { name: "twitter:description", content: "Private, time-limited access to a survivor's case documentation." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AttorneyView,
});

type Bundle = Awaited<ReturnType<typeof fetchSharedBundle>>;

function AttorneyView() {
  const { token } = useParams({ from: "/attorney/$token" });
  const fetcher = useServerFn(fetchSharedBundle);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetcher({ data: { token } }).then(setBundle).catch(() => setErr("We couldn't open this link."));
  }, [fetcher, token]);

  if (err) return <Frame><Message title="Link unavailable" body={err} /></Frame>;
  if (!bundle) return <Frame><Message title="Opening…" body="One moment." /></Frame>;
  if (bundle.status === "not-found") return <Frame><Message title="Link not found" body="This access link is invalid or has been deleted." /></Frame>;
  if (bundle.status === "rate-limited") return <Frame><Message title="Too many attempts" body="This link has been opened too many times in the last hour. Please wait a while and try again." /></Frame>;
  if (bundle.status === "revoked") return <Frame><Message title="Access revoked" body="The person who shared this with you has revoked access." /></Frame>;
  if (bundle.status === "expired") return <Frame><Message title="Access expired" body="This link has reached its expiration date." /></Frame>;

  return (
    <Frame>
      <header className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: "var(--safe)" }} />
          <div className="label-eyebrow">Read-only · shared with {bundle.attorney_name}</div>
        </div>
        <button onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2"><Printer size={15} /> Print / Save PDF</button>
      </header>

      <h1 className="font-serif text-[32px] leading-tight">Case records</h1>
      <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Shared confidentially. Please treat with discretion.
      </p>

      {bundle.case_overview && (
        <section className="card-pp mt-6">
          <h2 className="font-serif text-[20px]">Overview</h2>
          <dl className="mt-3 grid gap-2 text-[14px]">
            <Row label="Other party" v={bundle.case_overview.other_party ?? "—"} />
            <Row label="Relationship" v={bundle.case_overview.relationship_type ?? "—"} />
            <Row label="Case type" v={bundle.case_overview.case_types.join(", ") || "—"} />
            <Row label="Jurisdiction" v={bundle.case_overview.jurisdiction ?? "—"} />
          </dl>
          {bundle.case_overview.pattern_summary && (
            <>
              <div className="label-eyebrow mt-5">Pattern summary</div>
              <p className="mt-1 whitespace-pre-wrap text-[14px]">{bundle.case_overview.pattern_summary}</p>
            </>
          )}
        </section>
      )}

      {bundle.escalation_flags && bundle.escalation_flags.length > 0 && (
        <section className="card-pp mt-6">
          <div className="flex items-center gap-2"><AlertTriangle size={18} style={{ color: "var(--primary)" }} /><h2 className="font-serif text-[20px]">Active concerns</h2></div>
          <ul className="mt-3 space-y-2">
            {bundle.escalation_flags.map((f) => (
              <li key={f.id} className="text-[14px]"><strong>Tier {f.severity_tier}:</strong> {f.flag_type}{f.details ? ` — ${f.details}` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {bundle.incidents && bundle.incidents.length > 0 && (
        <section className="mt-6">
          <h2 className="font-serif text-[22px]">Incidents ({bundle.incidents.length})</h2>
          <div className="mt-3 space-y-3">
            {bundle.incidents.map((i) => {
              const linkedEv = bundle.evidence?.filter((e) => e.linked_incident_id === i.id) ?? [];
              return (
                <article key={i.id} className="card-pp">
                  <div className="font-serif italic text-[16px]">
                    {new Date(i.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                    {i.time ? ` · ${i.time.slice(0, 5)}` : ""}
                    {i.location ? ` · ${i.location}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {i.abuse_types.map((t) => (
                      <span key={t} className="pp-badge">{typeLabel(t)}</span>
                    ))}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{i.description}</p>
                  {i.witnesses && <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>Witnesses: {i.witnesses}</p>}
                  {linkedEv.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                      {linkedEv.map((e) => (
                        <ThumbCard key={e.id} ev={e} />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {bundle.evidence && bundle.evidence.length > 0 && (
        <section className="mt-6">
          <h2 className="font-serif text-[22px]">All evidence ({bundle.evidence.length})</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.evidence.map((e) => <ThumbCard key={e.id} ev={e} />)}
          </div>
        </section>
      )}

      <footer className="pp-card mt-10 flex items-center gap-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        <Lock size={12} /> This page contains private records. Access is logged.
      </footer>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div data-persona="attorney" className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicQuickExit />
      <div className="mx-auto max-w-4xl px-5 py-10 md:px-8">{children}</div>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-pp">
      <h1 className="font-serif text-[24px]">{title}</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>{body}</p>
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 font-semibold">{label}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function ThumbCard({ ev }: { ev: NonNullable<Bundle["evidence"]>[number] }) {
  return (
    <div className="card-pp" style={{ padding: 12 }}>
      <div className="font-serif text-[14px] leading-tight">{ev.title}</div>
      <div className="label-eyebrow mt-1">{new Date(ev.date).toLocaleDateString()}</div>
      {ev.file_type === "image" && ev.signed_url && (
        <img src={ev.signed_url} alt={ev.title} className="mt-2 max-h-40 w-full rounded-lg object-cover" />
      )}
      {ev.file_type === "audio" && ev.signed_url && <audio controls src={ev.signed_url} className="mt-2 w-full" />}
      {ev.file_type === "video" && ev.signed_url && <video controls src={ev.signed_url} className="mt-2 max-h-40 w-full rounded-lg" />}
      {ev.file_type === "document" && ev.signed_url && (
        <a href={ev.signed_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px]" style={{ color: "var(--accent)" }}>Open document →</a>
      )}
      {ev.description && <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>{ev.description}</p>}
    </div>
  );
}