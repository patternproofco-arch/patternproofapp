import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { typeLabel } from "@/lib/abuse-types";
import { BrandLogo } from "@/components/BrandLogo";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/court-packet")({
  component: CourtPacket,
});

interface CaseRow {
  other_party: string | null;
  relationship_type: string | null;
  case_types: string[];
  jurisdiction: string | null;
  pattern_summary: string | null;
  highlighted_incident_ids: string[];
  attached_evidence_ids: string[];
  legal_document_ids: string[];
}
interface Inc {
  id: string;
  date: string;
  description: string;
  abuse_types: string[];
}
interface Ev {
  id: string;
  title: string;
  date: string;
  file_type: string;
  linked_incident_id: string | null;
  file_url: string;
}
interface LegalDoc {
  id: string;
  document_type: string;
  title: string;
  case_number: string | null;
  court_name: string | null;
  judge_name: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  protected_party: string | null;
  restrained_party: string | null;
  incident_date: string | null;
  key_terms: string | null;
  file_type: string;
  file_url: string;
}

function CourtPacket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null);
  const [incidents, setIncidents] = useState<Inc[]>([]);
  const [evidence, setEvidence] = useState<Ev[]>([]);
  const [evUrls, setEvUrls] = useState<Record<string, string>>({});
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [legalUrls, setLegalUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const c = await supabase
        .from("cases")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      const row = (c.data?.[0] as CaseRow | undefined) ?? null;
      setCaseRow(row);
      if (!row) return;
      const [inc, ev] = await Promise.all([
        row.highlighted_incident_ids.length
          ? supabase
              .from("incidents")
              .select("id,date,description,abuse_types,source,confirmed_at")
              .eq("user_id", user.id)
              .in("id", row.highlighted_incident_ids)
              .is("deleted_at", null)
              .order("date", { ascending: true })
          : Promise.resolve({ data: [] as Inc[] }),
        row.attached_evidence_ids.length
          ? supabase
              .from("evidence")
              .select("id,title,date,file_type,linked_incident_id,file_url")
              .eq("user_id", user.id)
              .in("id", row.attached_evidence_ids)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as Ev[] }),
      ]);
      setIncidents((inc.data as Inc[] | null) ?? []);
      const evRows = (ev.data as Ev[] | null) ?? [];
      setEvidence(evRows);
      const urls: Record<string, string> = {};
      await Promise.all(
        evRows
          .filter((e) => e.file_type === "image")
          .map(async (e) => {
            const { data: s } = await supabase.storage
              .from("evidence-files")
              .createSignedUrl(e.file_url, 3600);
            if (s?.signedUrl) urls[e.id] = s.signedUrl;
          }),
      );
      setEvUrls(urls);
      const ldIds = row.legal_document_ids ?? [];
      if (ldIds.length) {
        const { data: ld } = await supabase
          .from("legal_documents")
          .select(
            "id,document_type,title,case_number,court_name,judge_name,effective_date,expiration_date,protected_party,restrained_party,incident_date,key_terms,file_type,file_url",
          )
          .eq("user_id", user.id)
          .in("id", ldIds);
        const docs = (ld as LegalDoc[] | null) ?? [];
        setLegalDocs(docs);
        const lUrls: Record<string, string> = {};
        await Promise.all(
          docs
            .filter((d) => d.file_type.startsWith("image/"))
            .map(async (d) => {
              const { data: s } = await supabase.storage
                .from("evidence-files")
                .createSignedUrl(d.file_url, 3600);
              if (s?.signedUrl) lUrls[d.id] = s.signedUrl;
            }),
        );
        setLegalUrls(lUrls);
      }
    })();
  }, [user]);

  if (!caseRow) {
    return (
      <div>
        <HubTabs tabs={CASE_TABS} />
        <div className="label-eyebrow">Professional-review packet</div>
        <h1 className="mt-2 font-serif text-[34px] leading-tight">Your packet isn't ready yet.</h1>
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Build your case in the Case Builder first — your packet will be ready here.
          </p>
          <button onClick={() => navigate({ to: "/case-builder" })} className="btn-primary mt-4">
            Go to Case Builder
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <HubTabs tabs={CASE_TABS} />
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-eyebrow">Professional-review packet</div>
          <h1 className="mt-2 font-serif text-[30px] leading-tight">Preview your packet.</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate({ to: "/case-builder" })}
            className="btn-ghost inline-flex items-center gap-1"
          >
            <Edit3 size={14} /> Edit Case
          </button>
          <button
            onClick={() => window.print()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>
      </div>

      <div
        id="packet"
        style={{
          background: "#fff",
          color: "#1A1224",
          padding: "32px 36px",
          border: "1px solid rgba(26,18,36,0.14)",
          borderRadius: 2,
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(26,18,36,0.14)",
            paddingBottom: 14,
          }}
        >
          <BrandLogo size={40} showTagline={false} />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#6E6579",
            }}
          >
            Prepared {today}
          </div>
        </div>

        <Section title="Case Overview">
          <Row label="Other party" value={caseRow.other_party ?? "—"} />
          <Row label="Relationship" value={caseRow.relationship_type ?? "—"} />
          <Row label="Case type" value={caseRow.case_types.join(", ") || "—"} />
          <Row label="Jurisdiction" value={caseRow.jurisdiction ?? "—"} />
        </Section>

        <Section title="Incident Timeline">
          {incidents.length === 0 ? (
            <p style={{ color: "#666" }}>No incidents highlighted.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Type</th>
                  <th style={th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i, idx) => (
                  <tr key={i.id} style={{ background: idx % 2 ? "#FAFAF8" : "#fff" }}>
                    <td style={td}>{new Date(i.date).toLocaleDateString()}</td>
                    <td style={td}>{i.abuse_types.map(typeLabel).join(", ")}</td>
                    <td style={td}>{i.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Pattern Summary">
          <p style={{ whiteSpace: "pre-wrap" }}>{caseRow.pattern_summary ?? "—"}</p>
        </Section>

        <Section title="Evidence Index">
          {evidence.length === 0 ? (
            <p style={{ color: "#666" }}>No evidence attached.</p>
          ) : (
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {evidence.map((e) => {
                const linked = incidents.find((i) => i.id === e.linked_incident_id);
                return (
                  <li key={e.id} style={{ marginBottom: 6 }}>
                    <strong>{e.title}</strong> — {new Date(e.date).toLocaleDateString()} ·{" "}
                    {e.file_type}
                    {linked && <> · linked to {new Date(linked.date).toLocaleDateString()}</>}
                  </li>
                );
              })}
            </ol>
          )}
          {evidence.filter((e) => e.file_type === "image" && evUrls[e.id]).length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {evidence
                .filter((e) => e.file_type === "image" && evUrls[e.id])
                .map((e) => (
                  <figure
                    key={e.id}
                    style={{ margin: 0, border: "1px solid #ccc", padding: 6, borderRadius: 2 }}
                  >
                    <img
                      src={evUrls[e.id]}
                      alt={e.title}
                      style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 2 }}
                    />
                    <figcaption style={{ marginTop: 4, fontSize: 11 }}>
                      {e.title} · {new Date(e.date).toLocaleDateString()}
                    </figcaption>
                  </figure>
                ))}
            </div>
          )}
        </Section>

        <Section title="Legal Documents">
          {legalDocs.length === 0 ? (
            <p style={{ color: "#666" }}>No legal documents attached.</p>
          ) : (
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {legalDocs.map((d) => (
                <li key={d.id} style={{ marginBottom: 10 }}>
                  <strong>{d.title}</strong>
                  {d.case_number ? ` — Case #${d.case_number}` : ""}
                  {d.court_name ? ` · ${d.court_name}` : ""}
                  {d.effective_date
                    ? ` · Effective ${new Date(d.effective_date).toLocaleDateString()}`
                    : ""}
                  {d.expiration_date
                    ? ` · Expires ${new Date(d.expiration_date).toLocaleDateString()}`
                    : ""}
                  {d.protected_party || d.restrained_party ? (
                    <div style={{ fontSize: 12, color: "#444" }}>
                      {d.protected_party ? `Protected: ${d.protected_party}` : ""}
                      {d.protected_party && d.restrained_party ? " · " : ""}
                      {d.restrained_party ? `Restrained: ${d.restrained_party}` : ""}
                    </div>
                  ) : null}
                  {d.key_terms && <div style={{ fontSize: 12, marginTop: 2 }}>{d.key_terms}</div>}
                  {!d.file_type.startsWith("image/") && (
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      See attached document on file.
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {legalDocs.filter((d) => d.file_type.startsWith("image/") && legalUrls[d.id]).length >
            0 && (
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {legalDocs
                .filter((d) => d.file_type.startsWith("image/") && legalUrls[d.id])
                .map((d) => (
                  <figure
                    key={d.id}
                    style={{ margin: 0, border: "1px solid #ccc", padding: 6, borderRadius: 2 }}
                  >
                    <img
                      src={legalUrls[d.id]}
                      alt={d.title}
                      style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 2 }}
                    />
                    <figcaption style={{ marginTop: 4, fontSize: 11 }}>{d.title}</figcaption>
                  </figure>
                ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 13,
  borderBottom: "1px solid #000",
};
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top", fontSize: 13 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 18, margin: "0 0 8px 0" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "4px 0" }}>
      <div style={{ width: 130, fontWeight: 600 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
