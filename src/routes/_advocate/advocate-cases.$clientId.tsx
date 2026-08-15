import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, FolderOpen, Lock, Target, User } from "lucide-react";
import { getAdvocateCase } from "@/lib/advocate.functions";

export const Route = createFileRoute("/_advocate/advocate-cases/$clientId")({
  component: AdvocateCaseView,
});

type CaseData = Awaited<ReturnType<typeof getAdvocateCase>>;

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : null);

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function AdvocateCaseView() {
  const { clientId } = Route.useParams();
  const getCase = useServerFn(getAdvocateCase);
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCase({ data: { clientId } })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "We couldn't open this workspace."));
  }, [getCase, clientId]);

  if (error) {
    return (
      <div className="orgx-panel" style={{ maxWidth: 620 }}>
        <h1 style={{ fontSize: 24 }}>This workspace isn't open to you right now</h1>
        <p className="orgx-muted" style={{ fontSize: 14 }}>
          Access may have been withdrawn or may have expired. Live access has ended.
        </p>
        <Link to="/advocate-cases" className="orgx-btn orgx-btn-quiet" style={{ marginTop: 14 }}>
          Back to shared survivors
        </Link>
      </div>
    );
  }
  if (!data) return <p style={{ fontSize: 13.5 }}>Loading…</p>;

  const label = data.case?.case_name?.trim() || data.case?.other_party?.trim() || "Shared workspace";
  const c = data.consent;

  return (
    <>
      <Link to="/advocate-cases" className="orgx-navitem" style={{ width: "auto", paddingLeft: 0, marginBottom: 18 }}>
        <ArrowLeft size={17} strokeWidth={1.7} aria-hidden /> Back to shared survivors
      </Link>

      <p className="orgx-eyebrow">Shared workspace</p>
      <h1 style={{ fontSize: 42, margin: "8px 0 10px" }}>{label}</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 640 }}>
        This workspace is shared by the person it belongs to. You can view <strong style={{ color: "var(--ox-ink)" }}>only
        what they have chosen to share</strong>.
      </p>

      <div className="orgx-facts" style={{ margin: "30px 0 4px" }}>
        <Fact icon={<User size={17} strokeWidth={1.7} aria-hidden />} label="Entries"
          value={c.include_all_incidents ? "All entries shared" : `${c.scoped_incident_count ?? 0} selected entries`} />
        <Fact icon={<FolderOpen size={17} strokeWidth={1.7} aria-hidden />} label="Evidence"
          value={c.include_all_evidence ? "All evidence shared" : `${c.scoped_evidence_count ?? 0} selected items`} />
        <Fact icon={<Target size={17} strokeWidth={1.7} aria-hidden />} label="Scope"
          value={`${c.case_scoped ? "Single case" : "All cases"} · grouping ${c.include_patterns ? "included" : "not shared"}`} />
        <Fact icon={<CalendarClock size={17} strokeWidth={1.7} aria-hidden />} label="Expires"
          value={fmt(c.expires_at) ?? "No expiry set"} />
      </div>

      <hr className="orgx-rule" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, maxWidth: 520 }}>
          <Lock size={18} strokeWidth={1.7} aria-hidden style={{ marginTop: 3, color: "var(--ox-sage)" }} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Unshared material is not visible.</div>
            <p className="orgx-muted" style={{ fontSize: 13.5, margin: "2px 0 0" }}>
              You will never see records that weren't included by the person sharing. Original files stay with them.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="orgx-btn" onClick={() => scrollTo("workspace")}>Review shared workspace</button>
          <button type="button" className="orgx-btn orgx-btn-quiet" onClick={() => scrollTo("consent")}>Open consent details</button>
        </div>
      </div>

      <hr className="orgx-rule" />

      <section id="workspace" aria-labelledby="h-timeline">
        <h2 id="h-timeline" style={{ fontSize: 26, marginBottom: 4 }}>Timeline</h2>
        <p className="orgx-muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
          {data.incidents.length} {data.incidents.length === 1 ? "entry" : "entries"} shared with you.
        </p>
        {data.incidents.length === 0 ? (
          <p className="orgx-muted" style={{ fontSize: 14 }}>No entries were shared with you.</p>
        ) : (
          <div className="orgx-rowlist">
            {data.incidents.map((i) => (
              <div key={i.id} style={{ padding: "18px 0", borderTop: "1px solid var(--ox-line)" }}>
                <div className="orgx-muted" style={{ fontSize: 12.5 }}>
                  {i.date}{i.time ? ` · ${i.time}` : ""}{i.location ? ` · ${i.location}` : ""}
                </div>
                <p style={{ fontSize: 14.5, lineHeight: 1.65, marginTop: 6, whiteSpace: "pre-wrap" }}>{i.description}</p>
                {(i.abuse_types ?? []).length > 0 && (
                  <div className="orgx-muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Tagged: {(i.abuse_types ?? []).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="orgx-rule" />

      <section aria-labelledby="h-evidence">
        <h2 id="h-evidence" style={{ fontSize: 26, marginBottom: 4 }}>Evidence</h2>
        <p className="orgx-muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
          Listed for context only. Original files stay with the person sharing.
        </p>
        {data.evidence.length === 0 ? (
          <p className="orgx-muted" style={{ fontSize: 14 }}>No evidence was shared with you.</p>
        ) : (
          <div className="orgx-rowlist">
            {data.evidence.map((e) => (
              <div key={e.id} className="orgx-row" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{e.title}</div>
                  {e.description && <p style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.6 }}>{e.description}</p>}
                </div>
                <span className="orgx-muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                  {e.date ?? "Date not set"}{e.file_type ? ` · ${e.file_type}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="orgx-rule" />

      <section aria-labelledby="h-case">
        <h2 id="h-case" style={{ fontSize: 26, marginBottom: 10 }}>Case summary</h2>
        <CaseSummary data={data} />
      </section>

      <hr className="orgx-rule" />

      <section id="consent" aria-labelledby="h-access">
        <h2 id="h-access" style={{ fontSize: 26, marginBottom: 10 }}>Your access</h2>
        <div className="orgx-panel" style={{ maxWidth: 640 }}>
          <Row label="Granted" value={fmt(c.granted_at) ?? "—"} />
          <Row label="Entries" value={c.include_all_incidents ? "All entries" : `${c.scoped_incident_count ?? 0} selected entries`} />
          <Row label="Evidence" value={c.include_all_evidence ? "All evidence items" : `${c.scoped_evidence_count ?? 0} selected items`} />
          <Row label="Pattern grouping" value={c.include_patterns ? "Included" : "Not shared"} />
          <Row label="Case scope" value={c.case_scoped ? "Single case" : "All of this person's cases"} />
          <Row
            label="Date window"
            value={
              c.date_range_start || c.date_range_end
                ? `${fmt(c.date_range_start) ?? "any"} — ${fmt(c.date_range_end) ?? "any"}`
                : "No date limit"
            }
          />
          <Row label="Expires" value={fmt(c.expires_at) ?? "No expiry set"} />
          <p className="orgx-muted" style={{ fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
            Access can be withdrawn at any time. When it is, this page stops opening immediately. Anything you already
            saved outside PatternProof stays with you and is yours to handle under your organization's records policy.
          </p>
        </div>
      </section>
    </>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="orgx-fact">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ox-sage)" }}>
        {icon}
        <span className="orgx-fact-label">{label}</span>
      </div>
      <div className="orgx-fact-value">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 14, lineHeight: 1.9 }}>
      <span className="orgx-muted" style={{ minWidth: 150 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CaseSummary({ data }: { data: CaseData }) {
  const c = data.case;
  if (!c) return <p className="orgx-muted" style={{ fontSize: 14 }}>No case summary has been shared yet.</p>;
  return (
    <div className="orgx-panel" style={{ maxWidth: 720 }}>
      {c.other_party ? <Row label="Other party" value={c.other_party} /> : null}
      {c.relationship_type ? <Row label="Relationship" value={c.relationship_type} /> : null}
      {c.jurisdiction ? <Row label="Jurisdiction" value={c.jurisdiction} /> : null}
      {(c.case_types ?? []).length ? <Row label="Case types" value={(c.case_types ?? []).join(", ")} /> : null}
      {c.pattern_summary ? (
        <>
          <div className="orgx-muted" style={{ fontSize: 12.5, marginTop: 14 }}>Summary written by the person sharing</div>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, marginTop: 4, whiteSpace: "pre-wrap" }}>{c.pattern_summary}</p>
        </>
      ) : null}
    </div>
  );
}
