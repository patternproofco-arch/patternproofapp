import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES, typeColor, typeLabel } from "@/lib/abuse-types";
import { formatIncidentDate } from "@/lib/dates";
import { isMaterialOtherPartyChange } from "@/lib/name-match";

export const Route = createFileRoute("/_authenticated/case-builder")({
  component: CaseBuilder,
});

const RELATIONSHIPS = ["Ex-partner", "Co-parent", "Current partner", "Family member", "Other"];
const CASE_TYPES = ["Domestic Violence", "Custody", "Divorce", "Protective Order", "Other"];

// Fuzzy name-comparison helpers live in src/lib/name-match.ts so the
// conflict-of-interest check reuses the same normalization + threshold.

interface IncRow {
  id: string;
  date: string | null;
  description: string;
  abuse_types: string[];
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  anchor_incident_id?: string | null;
  anchor_label?: string | null;
}
interface EvRow { id: string; title: string; date: string; file_type: string }
interface LegalRow { id: string; document_type: string; title: string; effective_date: string | null; case_number: string | null }
interface CaseRow {
  id: string;
  other_party: string | null;
  relationship_type: string | null;
  case_types: string[];
  jurisdiction: string | null;
  pattern_summary: string | null;
  highlighted_incident_ids: string[];
  attached_evidence_ids: string[];
  legal_document_ids: string[];
}

function CaseBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [savedOther, setSavedOther] = useState("");
  const [hasExistingCase, setHasExistingCase] = useState(false);
  const [rel, setRel] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [jurisdiction, setJurisdiction] = useState("");
  const [summary, setSummary] = useState("");
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [legalAttached, setLegalAttached] = useState<string[]>([]);
  const [incidents, setIncidents] = useState<IncRow[]>([]);
  const [evidence, setEvidence] = useState<EvRow[]>([]);
  const [legalDocs, setLegalDocs] = useState<LegalRow[]>([]);

  const loadCase = useCallback(async () => {
    if (!user) return;
    const [c, inc, ev, ld] = await Promise.all([
      supabase.from("cases").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1),
     supabase.from("incidents").select("id,date,description,abuse_types,date_precision,date_range_start,date_range_end,anchor_incident_id,anchor_label").eq("user_id", user.id).is("deleted_at", null).order("date", { ascending: false, nullsFirst: false }),
      supabase.from("evidence").select("id,title,date,file_type").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("legal_documents").select("id,document_type,title,effective_date,case_number").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setIncidents((inc.data as IncRow[] | null) ?? []);
    setEvidence((ev.data as EvRow[] | null) ?? []);
    setLegalDocs((ld.data as LegalRow[] | null) ?? []);
    const row = (c.data?.[0] as CaseRow | undefined);
    if (row) {
      setCaseId(row.id);
      setOther(row.other_party ?? "");
      setSavedOther(row.other_party ?? "");
      // "Existing" = the saved case has meaningful data, not just an empty stub.
      setHasExistingCase(Boolean(
        (row.other_party && row.other_party.trim()) ||
        (row.relationship_type && row.relationship_type.trim()) ||
        (row.case_types && row.case_types.length > 0) ||
        (row.pattern_summary && row.pattern_summary.trim()) ||
        (row.highlighted_incident_ids && row.highlighted_incident_ids.length > 0) ||
        (row.attached_evidence_ids && row.attached_evidence_ids.length > 0),
      ));
      setRel(row.relationship_type ?? "");
      setTypes(row.case_types ?? []);
      setJurisdiction(row.jurisdiction ?? "");
      setSummary(row.pattern_summary ?? "");
      setHighlighted(row.highlighted_incident_ids ?? []);
      setAttached(row.attached_evidence_ids ?? []);
      setLegalAttached(row.legal_document_ids ?? []);
    }
  }, [user]);

  useEffect(() => { loadCase(); }, [loadCase]);

  const persist = useCallback(async () => {
    if (!user) return;
    // Guard against silently overwriting an existing case file when the
    // survivor is (probably) trying to document a different situation.
    if (
      caseId &&
      hasExistingCase &&
      isMaterialOtherPartyChange(savedOther, other)
    ) {
      const ok = window.confirm(
        `This will update your existing case file for ${savedOther}. ` +
        `If you're documenting a different situation, this isn't the way to do it yet — ` +
        `multiple cases aren't supported. Continuing will overwrite what's here.`,
      );
      if (!ok) {
        // Revert the field so nothing else in this save cycle uses the new value.
        setOther(savedOther);
        return;
      }
    }
    const payload = {
      user_id: user.id,
      other_party: other || null,
      relationship_type: rel || null,
      case_types: types,
      jurisdiction: jurisdiction || null,
      pattern_summary: summary || null,
      highlighted_incident_ids: highlighted,
      attached_evidence_ids: attached,
      legal_document_ids: legalAttached,
    };
    if (caseId) {
      await supabase.from("cases").update(payload).eq("id", caseId).eq("user_id", user.id);
      setSavedOther(other);
    } else {
      const { data } = await supabase.from("cases").insert(payload).select("id").single();
      if (data?.id) {
        setCaseId(data.id);
        setSavedOther(other);
        setHasExistingCase(Boolean(other || rel || types.length || summary));
      }
    }
  }, [user, caseId, hasExistingCase, savedOther, other, rel, types, jurisdiction, summary, highlighted, attached, legalAttached]);

  // auto-save when step changes
  useEffect(() => { const t = setTimeout(persist, 500); return () => clearTimeout(t); }, [persist, step]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    incidents.forEach((i) => i.abuse_types.forEach((t) => { m[t] = (m[t] ?? 0) + 1; }));
    return m;
  }, [incidents]);

  const finish = async () => {
    await persist();
    toast("Your case is ready to view.");
    navigate({ to: "/court-packet" });
  };

  const toggle = (list: string[], v: string, set: (x: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div>
      <div className="label-eyebrow">Case builder</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">Shape your case, <em>step by step.</em></h1>

      <div
        className="mt-4 rounded-xl p-3 text-[13px]"
        style={{ background: "var(--input)", borderLeft: "3px solid var(--accent)" }}
      >
        PatternProof currently supports one case file per account. If you need to
        document a separate legal matter, let us know.
      </div>

      {/* Progress */}
      <div className="mt-6 flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
              style={{ background: step >= n ? "var(--primary)" : "var(--input)", color: step >= n ? "var(--primary-foreground)" : "var(--foreground)" }}>{n}</div>
            {n < 4 && <div className="h-[2px] flex-1" style={{ background: step > n ? "var(--primary)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      <div className="card-pp mt-6 space-y-4">
        {step === 1 && (
          <>
            <h2 className="font-serif text-[20px]">Case overview</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label-eyebrow">Other party (name or initials)</label>
                <input className="input-pp mt-1" value={other} onChange={(e) => setOther(e.target.value)} />
              </div>
              <div>
                <label className="label-eyebrow">Your relationship</label>
                <select className="input-pp mt-1" value={rel} onChange={(e) => setRel(e.target.value)}>
                  <option value="">— Select —</option>
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label-eyebrow">Case type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CASE_TYPES.map((t) => {
                    const on = types.includes(t);
                    return (
                      <button key={t} type="button" onClick={() => toggle(types, t, setTypes)}
                        className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
                        style={{ background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--foreground)", border: "1.5px solid var(--accent)" }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="label-eyebrow">State / jurisdiction</label>
                <input className="input-pp mt-1" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. California, USA" />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-serif text-[20px]">Pattern summary</h2>
            <div className="rounded-xl p-4" style={{ background: "var(--input)" }}>
              <div className="label-eyebrow">By type</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {ABUSE_TYPES.map((t) => (
                  <div key={t.value} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                    <span className="text-[13px]">{t.label}: <strong>{typeCounts[t.value] ?? 0}</strong></span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="label-eyebrow">Pattern</label>
              <textarea className="input-pp mt-1 min-h-[180px]" value={summary} onChange={(e) => setSummary(e.target.value)}
                placeholder="In your own words, describe the pattern you've experienced. What keeps happening? What has changed over time?" />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-serif text-[20px]">Key incidents</h2>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Choose the incidents that best show the pattern or that had the most significant impact. (Up to 10)
            </p>
            <div className="space-y-2">
              {incidents.length === 0 && <p className="text-[13px]">No incidents logged yet.</p>}
              {incidents.map((i) => {
                const on = highlighted.includes(i.id);
                const disabled = !on && highlighted.length >= 10;
                return (
                  <label key={i.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                    style={{ background: on ? "var(--input)" : "transparent", borderLeft: `3px solid ${typeColor(i.abuse_types[0] ?? "other")}` }}>
                    <input type="checkbox" checked={on} disabled={disabled}
                      onChange={() => toggle(highlighted, i.id, setHighlighted)} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="label-eyebrow">{formatIncidentDate(i)} · {i.abuse_types.map(typeLabel).join(", ")}</div>
                      <div className="mt-1 line-clamp-2 text-[13px]">{i.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-serif text-[20px]">Supporting evidence</h2>
            <div className="space-y-2">
              {evidence.length === 0 && <p className="text-[13px]">No evidence uploaded yet.</p>}
              {evidence.map((e) => {
                const on = attached.includes(e.id);
                return (
                  <label key={e.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                    style={{ background: on ? "var(--input)" : "transparent" }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(attached, e.id, setAttached)} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-[15px]">{e.title}</div>
                      <div className="label-eyebrow mt-1">{e.date} · {e.file_type}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <h2 className="mt-6 font-serif text-[20px]">Legal documents</h2>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Attach any TROs, police reports, or court orders that belong with this case.
            </p>
            <div className="space-y-2">
              {legalDocs.length === 0 && <p className="text-[13px]">No legal documents saved yet.</p>}
              {legalDocs.map((l) => {
                const on = legalAttached.includes(l.id);
                return (
                  <label key={l.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                    style={{ background: on ? "var(--input)" : "transparent" }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(legalAttached, l.id, setLegalAttached)} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-[15px]">{l.title}</div>
                      <div className="label-eyebrow mt-1">
                        {l.document_type.replace("_", " ")}
                        {l.case_number ? ` · Case #${l.case_number}` : ""}
                        {l.effective_date ? ` · ${l.effective_date}` : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="btn-ghost">Back</button>
        {step < 4
          ? <button onClick={() => setStep((s) => Math.min(4, s + 1))} className="btn-primary">Next</button>
          : <button onClick={finish} className="btn-primary">Build Professional-Review Packet</button>}
      </div>
    </div>
  );
}