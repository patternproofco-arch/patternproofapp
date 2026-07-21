import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, Trash2, Download, Pencil, ChevronDown, ChevronRight, Link as LinkIcon, X, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { extractLegalDocument } from "@/lib/legal-extract.functions";
import { listDriveFiles, downloadDriveFile } from "@/lib/drive-import.functions";
import { logAudit } from "@/lib/audit.functions";

export const Route = createFileRoute("/_authenticated/legal-documents")({
  component: LegalDocumentsPage,
});

type DocType =
  | "tro" | "fro" | "police_report" | "911_log"
  | "cps_report" | "custody_order" | "court_order"
  | "hearing_transcript" | "other";

interface LegalDoc {
  id: string;
  document_type: DocType;
  title: string;
  file_url: string;
  file_type: string;
  case_number: string | null;
  court_name: string | null;
  judge_name: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  protected_party: string | null;
  restrained_party: string | null;
  issuing_officer: string | null;
  incident_date: string | null;
  key_terms: string | null;
  linked_incident_ids: string[] | null;
  notes: string | null;
  ai_extracted: boolean;
  created_at: string;
}

interface Incident { id: string; date: string; description: string }

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "tro", label: "Temporary Restraining Order (TRO)" },
  { value: "fro", label: "Final Restraining Order (FRO)" },
  { value: "police_report", label: "Police Report" },
  { value: "911_log", label: "911 Call Log" },
  { value: "cps_report", label: "CPS / DCPP Report" },
  { value: "custody_order", label: "Custody Order" },
  { value: "court_order", label: "Court Order" },
  { value: "hearing_transcript", label: "Hearing Transcript" },
  { value: "other", label: "Other" },
];

const BADGE: Record<DocType, { label: string; bg: string; fg: string }> = {
  tro:                { label: "TRO",            bg: "#E77B56", fg: "#2A1A10" },
  fro:                { label: "FRO",            bg: "#E77B56", fg: "#2A1A10" },
  police_report:      { label: "Police Report",  bg: "#6A92D6", fg: "#2A1A10" },
  "911_log":          { label: "911 Log",        bg: "#6A92D6", fg: "#2A1A10" },
  custody_order:      { label: "Custody Order",  bg: "#A8D8B9", fg: "#2A1A10" },
  court_order:        { label: "Court Order",    bg: "#A8D8B9", fg: "#2A1A10" },
  cps_report:         { label: "CPS",            bg: "#D2B48C", fg: "#2A1A10" },
  hearing_transcript: { label: "Transcript",     bg: "#B57E60", fg: "#F5E6DF" },
  other:              { label: "Other",          bg: "#B57E60", fg: "#F5E6DF" },
};

const GROUPS: { label: string; types: DocType[] }[] = [
  { label: "Restraining Orders", types: ["tro", "fro"] },
  { label: "Police Reports",     types: ["police_report", "911_log"] },
  { label: "Court Orders",       types: ["custody_order", "court_order", "hearing_transcript"] },
  { label: "CPS Records",        types: ["cps_report"] },
  { label: "Other Documents",    types: ["other"] },
];

type Extracted = {
  document_type_confirmed?: string | null;
  case_number?: string | null;
  court_name?: string | null;
  judge_name?: string | null;
  effective_date?: string | null;
  expiration_date?: string | null;
  protected_party?: string | null;
  restrained_party?: string | null;
  issuing_officer?: string | null;
  incident_date?: string | null;
  key_terms?: string | null;
  suggested_title?: string | null;
  cross_reference_note?: string | null;
};

function emptyExtracted(): Extracted {
  return {
    document_type_confirmed: null, case_number: null, court_name: null,
    judge_name: null, effective_date: null, expiration_date: null,
    protected_party: null, restrained_party: null, issuing_officer: null,
    incident_date: null, key_terms: null, suggested_title: null,
    cross_reference_note: null,
  };
}

function LegalDocumentsPage() {
  const { user } = useAuth();
  const extract = useServerFn(extractLegalDocument);
  const driveList = useServerFn(listDriveFiles);
  const driveDownload = useServerFn(downloadDriveFile);
  const log = useServerFn(logAudit);

  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pending, setPending] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType | "">("");
  const [phase, setPhase] = useState<"idle" | "extracting" | "confirm" | "manual">("idle");
  const [pendingKey, setPendingKey] = useState<string>("");
  const [extracted, setExtracted] = useState<Extracted>(emptyExtracted());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveQuery, setDriveQuery] = useState("");
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string; modifiedTime?: string }>>([]);
  const [driveError, setDriveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [d, i] = await Promise.all([
      supabase.from("legal_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("incidents").select("id,date,description").eq("user_id", user.id).order("date", { ascending: false }),
    ]);
    setDocs((d.data as LegalDoc[] | null) ?? []);
    setIncidents((i.data as Incident[] | null) ?? []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setPending(null); setDocType(""); setPhase("idle");
    setPendingKey(""); setExtracted(emptyExtracted());
    if (inputRef.current) inputRef.current.value = "";
  };

  const openDrivePicker = async () => {
    setDriveOpen(true);
    setDriveError(null);
    setDriveBusy(true);
    const r = await driveList({ data: { query: driveQuery || undefined } });
    setDriveBusy(false);
    if (r.ok) setDriveFiles(r.files);
    else setDriveError(r.reason === "missing-drive-connection"
      ? "Google Drive isn't connected yet. Reach out to your project owner to enable it."
      : "We couldn't reach Google Drive. Try again in a moment.");
  };

  const searchDrive = async () => {
    setDriveBusy(true);
    setDriveError(null);
    const r = await driveList({ data: { query: driveQuery || undefined } });
    setDriveBusy(false);
    if (r.ok) setDriveFiles(r.files);
    else setDriveError("Search failed. Try again.");
  };

  const pickDriveFile = async (f: { id: string; name: string; mimeType: string }) => {
    setDriveOpen(false);
    setPhase("extracting");
    const dl = await driveDownload({ data: { fileId: f.id } });
    if (!dl.ok) {
      toast(dl.reason === "too-large" ? "That file is too large to import." : "We couldn't import that file.");
      setPhase("idle");
      return;
    }
    const bin = Uint8Array.from(atob(dl.base64), (c) => c.charCodeAt(0));
    const file = new File([bin], dl.filename, { type: dl.mimeType });
    setPending(file);
    setPhase("idle");
    toast("Imported from Google Drive. Pick a document type to continue.");
  };

  const startExtraction = async () => {
    if (!user || !pending || !docType) return;
    setPhase("extracting");

    // Upload first
    const ext = pending.name.split(".").pop() ?? "bin";
    const key = `${user.id}/legal/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const up = await supabase.storage.from("evidence-files").upload(key, pending);
    if (up.error) {
      toast("We couldn't upload that. Try again in a moment.");
      setPhase("idle"); return;
    }
    setPendingKey(key);
    await log({ data: { action_type: "legal_document_uploaded", record_reference: key } });

    // Get signed URL for AI
    const signed = await supabase.storage.from("evidence-files").createSignedUrl(key, 600);
    if (!signed.data?.signedUrl) {
      setExtracted({ ...emptyExtracted(), suggested_title: pending.name.replace(/\.[^.]+$/, "") });
      setPhase("manual"); return;
    }

    const result = await extract({
      data: {
        signedUrl: signed.data.signedUrl,
        mimeType: pending.type || "application/octet-stream",
        documentType: docType,
        filename: pending.name,
      },
    });

    if (result.ok) {
      setExtracted(result.extracted as Extracted);
      await log({ data: { action_type: "legal_document_extracted", record_reference: key } });
      setPhase("confirm");
    } else {
      setExtracted({ ...emptyExtracted(), suggested_title: pending.name.replace(/\.[^.]+$/, "") });
      setPhase("manual");
    }
  };

  const saveExtracted = async (confirmed: boolean) => {
    if (!user || !pending || !pendingKey || !docType) return;
    const title = (extracted.suggested_title || pending.name.replace(/\.[^.]+$/, "")).slice(0, 200);
    const row = {
      user_id: user.id,
      document_type: docType,
      title,
      file_url: pendingKey,
      file_type: pending.type || "application/octet-stream",
      case_number: extracted.case_number || null,
      court_name: extracted.court_name || null,
      judge_name: extracted.judge_name || null,
      effective_date: extracted.effective_date || null,
      expiration_date: extracted.expiration_date || null,
      protected_party: extracted.protected_party || null,
      restrained_party: extracted.restrained_party || null,
      issuing_officer: extracted.issuing_officer || null,
      incident_date: extracted.incident_date || null,
      key_terms: extracted.key_terms || null,
      ai_extracted: phase === "confirm",
      ai_extraction_confirmed: confirmed,
    };
    const ins = await supabase.from("legal_documents").insert(row).select("id").single();
    if (ins.error || !ins.data) {
      toast("We couldn't save that. Try again in a moment.");
      return;
    }
    // Mirror to evidence
    await supabase.from("evidence").insert({
      user_id: user.id,
      title: `[Legal] ${title}`,
      date: extracted.incident_date || extracted.effective_date || new Date().toISOString().slice(0, 10),
      description: extracted.key_terms || null,
      file_url: pendingKey,
      file_type: "document",
    });
    await log({ data: { action_type: "legal_document_confirmed", record_reference: ins.data.id } });
    toast("Document saved to your legal record room.");
    reset();
    load();
  };

  const remove = async (d: LegalDoc) => {
    if (!user) return;
    if (!confirm("Remove this legal document?")) return;
    await supabase.storage.from("evidence-files").remove([d.file_url]);
    await supabase.from("legal_documents").delete().eq("id", d.id).eq("user_id", user.id);
    await log({ data: { action_type: "legal_document_deleted", record_reference: d.id } });
    toast("Removed.");
    load();
  };

  const openFile = async (d: LegalDoc) => {
    const { data } = await supabase.storage.from("evidence-files").createSignedUrl(d.file_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const linkIncident = async (d: LegalDoc, incidentId: string) => {
    if (!user) return;
    const existing = d.linked_incident_ids ?? [];
    if (existing.includes(incidentId)) return;
    const next = [...existing, incidentId];
    await supabase.from("legal_documents").update({ linked_incident_ids: next }).eq("id", d.id).eq("user_id", user.id);
    await log({ data: { action_type: "legal_document_linked_to_incident", record_reference: d.id } });
    load();
  };

  const updateField = (k: keyof Extracted, v: string) => {
    setExtracted((prev) => ({ ...prev, [k]: v || null }));
  };

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  return (
    <div>
      <div className="label-eyebrow">Legal Documents</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Your official <em>record room.</em>
      </h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        TROs, police reports, court orders, and custody agreements — everything the legal system has already produced about your case.
      </p>

      {/* Upload card */}
      <div className="card-pp mt-6 space-y-4">
        <label
          className={`block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${phase === "extracting" ? "animate-pulse" : ""}`}
          style={{ borderColor: "var(--border)" }}
        >
          <Upload size={26} className="mx-auto mb-2" style={{ color: "var(--muted-foreground)" }} />
          <div className="font-serif text-[16px]">
            {pending ? pending.name : "Drop a document here, or tap to choose"}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            PDF, JPG, PNG, HEIC, WEBP, DOCX
          </div>
          <input ref={inputRef} type="file" className="hidden"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => { setPending(e.target.files?.[0] ?? null); setPhase("idle"); }} />
        </label>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={openDrivePicker}
            className="btn-ghost inline-flex items-center justify-center gap-2 self-start text-[13px]"
          >
            <FileText size={14} /> Import from Google Drive
          </button>
          <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            Pull a PDF or image straight from your Drive — we'll read it the same way.
          </div>
        </div>

        {pending && phase === "idle" && (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="label-eyebrow">Document type</label>
              <select className="input-pp mt-1" value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
                <option value="">— Choose —</option>
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <button onClick={startExtraction} disabled={!docType} className="btn-primary">
                Extract Information
              </button>
            </div>
          </div>
        )}

        {phase === "extracting" && (
          <div className="text-center text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Reading your document. This takes a few seconds.
          </div>
        )}

        {(phase === "confirm" || phase === "manual") && (
          <ConfirmationCard
            phase={phase}
            extracted={extracted}
            update={updateField}
            incidents={incidents}
            onSave={() => saveExtracted(phase === "confirm")}
            onCancel={reset}
          />
        )}
      </div>

      {driveOpen && (
        <DrivePickerModal
          query={driveQuery}
          setQuery={setDriveQuery}
          onSearch={searchDrive}
          files={driveFiles}
          busy={driveBusy}
          error={driveError}
          onPick={pickDriveFile}
          onClose={() => setDriveOpen(false)}
        />
      )}

      {/* Document list */}
      <div className="mt-10">
        {docs.length === 0 ? (
          <div className="card-pp">
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              Upload a TRO, police report, or court order and we'll read it for you — pulling out the key details so you don't have to.
            </p>
          </div>
        ) : (
          GROUPS.map((g) => {
            const list = docs.filter((d) => g.types.includes(d.document_type));
            if (list.length === 0) return null;
            const isCollapsed = collapsed[g.label];
            return (
              <div key={g.label} className="mb-6">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [g.label]: !c[g.label] }))}
                  className="mb-3 flex w-full items-center justify-between"
                >
                  <span className="font-serif text-[18px]">{g.label}</span>
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                {!isCollapsed && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {list.map((d) => {
                      const b = BADGE[d.document_type];
                      const expired = d.expiration_date && d.expiration_date < today;
                      const soon = d.expiration_date && !expired && d.expiration_date <= in30;
                      const keyDate = d.effective_date || d.incident_date;
                      const firstSentence = (d.key_terms ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
                      return (
                        <div key={d.id} className="card-pp" style={{ borderLeft: `3px solid ${b.bg}` }}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: b.bg, color: b.fg }}>
                              {b.label}
                            </span>
                            {d.expiration_date && (
                              <span className="text-[11px]" style={{ color: expired ? "var(--muted-foreground)" : soon ? "#8B6F4E" : "var(--muted-foreground)", textDecoration: expired ? "line-through" : "none" }}>
                                {expired ? `Expired ${d.expiration_date}` : soon ? `Expires soon · ${d.expiration_date}` : `Expires ${d.expiration_date}`}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 font-serif text-[17px] leading-tight">{d.title}</div>
                          {keyDate && <div className="label-eyebrow mt-1">{new Date(keyDate).toLocaleDateString()}</div>}
                          {d.case_number && <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>Case #{d.case_number}</div>}
                          {firstSentence && <p className="mt-2 text-[13px]" style={{ color: "var(--foreground)" }}>{firstSentence}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button onClick={() => openFile(d)} className="btn-ghost inline-flex items-center gap-1 text-[12px]">
                              <Download size={13} /> View original
                            </button>
                            <details className="text-[12px]">
                              <summary className="btn-ghost inline-flex cursor-pointer items-center gap-1"><LinkIcon size={13} /> Link to incident</summary>
                              <div className="mt-2 max-h-40 overflow-auto rounded-xl bg-[rgba(0,0,0,0.05)] p-2">
                                {incidents.length === 0 && <div style={{ color: "var(--muted-foreground)" }}>No incidents yet.</div>}
                                {incidents.map((i) => (
                                  <button key={i.id} onClick={() => linkIncident(d, i.id)} className="block w-full text-left text-[12px] hover:underline">
                                    {i.date} · {i.description.slice(0, 50)}
                                  </button>
                                ))}
                              </div>
                            </details>
                            <button
                              onClick={() => toast("Editing legal documents is coming soon. For now, delete and re-add if you need changes.")}
                              className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                              title="Coming soon"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button onClick={() => remove(d)} className="btn-ghost inline-flex items-center gap-1 text-[12px]">
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                          {d.linked_incident_ids && d.linked_incident_ids.length > 0 && (
                            <div className="mt-2 text-[11px]" style={{ color: "var(--accent)" }}>
                              Linked to {d.linked_incident_ids.length} incident{d.linked_incident_ids.length === 1 ? "" : "s"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | null | undefined; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 md:grid-cols-[180px_1fr] md:items-center md:gap-3">
      <div className="label-eyebrow">{label}</div>
      <input
        type={type}
        className="input-pp"
        value={value ?? ""}
        placeholder={value == null ? "Not found — add manually" : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ConfirmationCard({
  phase, extracted, update, onSave, onCancel,
}: {
  phase: "confirm" | "manual";
  extracted: Extracted;
  update: (k: keyof Extracted, v: string) => void;
  incidents: Incident[];
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.05)" }}>
      <h3 className="font-serif text-[18px]">
        {phase === "confirm" ? "Here's what I found. Does this look right?" : "Fill in what you know — it's okay to leave fields blank."}
      </h3>
      {phase === "manual" && (
        <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          We couldn't read this document automatically.
        </p>
      )}
      <div className="mt-4 space-y-3">
        <Field label="Title" value={extracted.suggested_title} onChange={(v) => update("suggested_title", v)} />
        <Field label="Case number" value={extracted.case_number} onChange={(v) => update("case_number", v)} />
        <Field label="Court name" value={extracted.court_name} onChange={(v) => update("court_name", v)} />
        <Field label="Judge name" value={extracted.judge_name} onChange={(v) => update("judge_name", v)} />
        <Field label="Effective date" value={extracted.effective_date} onChange={(v) => update("effective_date", v)} type="date" />
        <Field label="Expiration date" value={extracted.expiration_date} onChange={(v) => update("expiration_date", v)} type="date" />
        <Field label="Protected party" value={extracted.protected_party} onChange={(v) => update("protected_party", v)} />
        <Field label="Restrained party" value={extracted.restrained_party} onChange={(v) => update("restrained_party", v)} />
        <Field label="Issuing officer" value={extracted.issuing_officer} onChange={(v) => update("issuing_officer", v)} />
        <Field label="Incident date" value={extracted.incident_date} onChange={(v) => update("incident_date", v)} type="date" />
        <div className="grid grid-cols-1 gap-1 md:grid-cols-[180px_1fr] md:items-start md:gap-3">
          <div className="label-eyebrow pt-2">Key terms</div>
          <textarea
            className="input-pp min-h-[90px]"
            value={extracted.key_terms ?? ""}
            placeholder={extracted.key_terms == null ? "Not found — add manually" : ""}
            onChange={(e) => update("key_terms", e.target.value)}
          />
        </div>
      </div>
      {extracted.cross_reference_note && (
        <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(106,146,214,0.15)", border: "1px solid rgba(106,146,214,0.3)" }}>
          <span className="text-[12px] font-semibold">AI notice: </span>
          <span className="text-[12px]">{extracted.cross_reference_note}</span>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={onSave} className="btn-primary">Save This Document</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function DrivePickerModal({
  query, setQuery, onSearch, files, busy, error, onPick, onClose,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSearch: () => void;
  files: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string }>;
  busy: boolean;
  error: string | null;
  onPick: (f: { id: string; name: string; mimeType: string }) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="card-pp w-full max-w-xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="label-eyebrow">Google Drive</div>
            <h3 className="mt-1 font-serif text-[20px]">Choose a document to import</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-black/5" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input-pp flex-1"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSearch(); } }}
          />
          <button onClick={onSearch} className="btn-ghost inline-flex items-center gap-1 text-[13px]"><Search size={14} /> Search</button>
        </div>

        <div className="mt-4 overflow-auto" style={{ flex: 1 }}>
          {busy && <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>Looking through your Drive…</p>}
          {!busy && error && <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>{error}</p>}
          {!busy && !error && files.length === 0 && (
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              No PDFs or images found. Try a different search term.
            </p>
          )}
          {!busy && !error && files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => onPick(f)}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-black/5"
                  >
                    <FileText size={16} style={{ color: "var(--muted-foreground)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-serif text-[14px]">{f.name}</div>
                      <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {f.mimeType.replace("application/", "").replace("image/", "")}
                        {f.modifiedTime ? ` · ${new Date(f.modifiedTime).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}