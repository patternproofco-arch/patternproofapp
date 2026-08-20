import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileText,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Send,
  Copy,
  RotateCw,
  X,
  Mail,
  Plus,
  Upload,
  Users,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { listMyClients } from "@/lib/attorney-portal.functions";
import { listClioMatterLinks, unlinkClioMatter } from "@/lib/clio-matter-links.functions";
import {
  listSurvivorInvites,
  createSurvivorInvite,
  createSurvivorInvitesBulk,
  revokeSurvivorInvite,
  resendSurvivorInvite,
} from "@/lib/attorney-survivor-invites.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_attorney/clients/")({
  component: ClientsIndex,
});

type ClientRow = Awaited<ReturnType<typeof listMyClients>>["clients"][number];
type MatterLinkRow = Awaited<ReturnType<typeof listClioMatterLinks>>["links"][number];
type InviteRow = Awaited<ReturnType<typeof listSurvivorInvites>>["invites"][number];

const DENSITY: Record<string, { label: string }> = {
  low: { label: "Low" },
  moderate: { label: "Moderate" },
  elevated: { label: "Elevated" },
  high: { label: "High" },
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});
const fmtDate = (v: string | null | undefined) => (v ? DATE_FMT.format(new Date(v)) : "—");

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#FFFFFF", fg: "var(--att-text-2)", label: "Pending" },
  accepted: { bg: "rgba(21,32,56,0.06)", fg: "var(--att-navy)", label: "Accepted" },
  expired: { bg: "#FFFFFF", fg: "var(--att-muted)", label: "Expired" },
  revoked: { bg: "#FFFFFF", fg: "var(--att-muted)", label: "Revoked" },
};

function ClientsIndex() {
  const fetcher = useServerFn(listMyClients);
  const invitesFetcher = useServerFn(listSurvivorInvites);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const sub = useSubscription();
  const matterLinksFetcher = useServerFn(listClioMatterLinks);
  const [matterLinks, setMatterLinks] = useState<MatterLinkRow[]>([]);
  const reloadMatterLinks = useCallback(
    () =>
      matterLinksFetcher()
        .then((r) => setMatterLinks(r.links))
        .catch(() => setMatterLinks([])),
    [matterLinksFetcher],
  );
  useEffect(() => {
    void reloadMatterLinks();
  }, [reloadMatterLinks]);

  useEffect(() => {
    fetcher().then((r) => setClients(r.clients));
  }, [fetcher]);
  useEffect(() => {
    invitesFetcher().then((r) => setInvites(r.invites));
  }, [invitesFetcher]);

  const reloadInvites = () => invitesFetcher().then((r) => setInvites(r.invites));

  return (
    <div>
      <div className="att-eyebrow">Case files</div>
      <h1 className="att-page-title">Matters</h1>
      <p
        style={{ color: "var(--att-text-2)", maxWidth: 620, margin: "6px 0 18px", fontSize: 12.5 }}
      >
        Every survivor who has shared their PatternProof case file with you. Read-only. Case opens,
        downloads, and exports are recorded.
      </p>

      {/* Diagnosis card — never shows a raw empty grid */}
      <DiagnosisCard clientCount={clients?.length ?? null} tier={sub.tier} />

      <InvitePanel invites={invites} onChange={reloadInvites} />

      {clients === null && <ClientTable clients={null} />}

      {clients &&
        clients.length > 0 &&
        (() => {
          const owned = clients.filter(
            (c) =>
              (c as any).access_kind !== "granted" && (c as any).access_kind !== "collaborator",
          );
          const shared = clients.filter(
            (c) =>
              (c as any).access_kind === "granted" || (c as any).access_kind === "collaborator",
          );
          return (
            <>
              <ClientTable
                clients={owned}
                matterLinks={matterLinks}
                onMatterChange={reloadMatterLinks}
              />
              {shared.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <div className="att-eyebrow" style={{ marginBottom: 8 }}>
                    Shared with you · granted by a firm colleague
                  </div>
                  <ClientTable
                    clients={shared}
                    sharedBadge
                    matterLinks={matterLinks}
                    onMatterChange={reloadMatterLinks}
                  />
                </div>
              )}
            </>
          );
        })()}
    </div>
  );
}

type SortKey =
  | "client"
  | "linked_at"
  | "incident_count"
  | "evidence_count"
  | "escalation_flag_count"
  | "last_incident_date";

function ClientTable({
  clients,
  sharedBadge,
  matterLinks,
  onMatterChange,
}: {
  clients: ClientRow[] | null;
  sharedBadge?: boolean;
  matterLinks?: MatterLinkRow[];
  onMatterChange?: () => void;
}) {
  const unlinkFn = useServerFn(unlinkClioMatter);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "last_incident_date",
    dir: "desc",
  });

  const rows = useMemo(() => {
    if (!clients) return null;
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? clients.filter(
          (c) =>
            c.client_user_id.toLowerCase().includes(needle) ||
            `pp-${c.client_user_id.slice(0, 4)}`.includes(needle) ||
            c.documentation_density.toLowerCase().includes(needle),
        )
      : clients;
    const val = (c: ClientRow): string | number => {
      switch (sort.key) {
        case "client":
          return c.client_user_id;
        case "linked_at":
          return c.linked_at ?? "";
        case "last_incident_date":
          return c.last_incident_date ?? "";
        default:
          return (c as any)[sort.key] as number;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [clients, q, sort]);

  if (clients && clients.length === 0) return null;

  const th = (key: SortKey, label: string, num?: boolean) => (
    <th
      className={`sortable ${sort.key === key ? "sorted" : ""}`}
      style={{ textAlign: num ? "right" : "left" }}
      onClick={() =>
        setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))
      }
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        {label}
        {sort.key === key &&
          (sort.dir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </span>
    </th>
  );

  return (
    <div className="att-table-wrap">
      <div className="att-table-toolbar">
        <span className="att-search-wrap">
          <Search size={12} style={{ position: "absolute", left: 9, color: "var(--att-slate)" }} />
          <input
            className="att-input"
            placeholder="Search matters…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={!clients}
          />
        </span>
        <span className="att-table-count">
          {rows ? `${rows.length} matter${rows.length === 1 ? "" : "s"}` : "Loading"}
        </span>
      </div>
      <div className="att-table-scroll">
        <table className="att-table">
          <thead>
            <tr>
              {th("client", "Client")}
              <th>Case ID</th>
              <th>Density</th>
              {th("incident_count", "Incidents", true)}
              {th("evidence_count", "Evidence", true)}
              {th("escalation_flag_count", "Flags", true)}
              <th style={{ textAlign: "right" }}>Activity</th>
              {th("last_incident_date", "Latest incident")}
              {th("linked_at", "Linked")}
              <th />
            </tr>
          </thead>
          <tbody>
            {!rows &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} className="att-td-tight">
                      <span className="att-skel" style={{ width: j === 0 ? "70%" : "45%" }} />
                    </td>
                  ))}
                </tr>
              ))}
            {rows?.map((c) => {
              const caseId = `PP-${c.client_user_id.slice(0, 4).toUpperCase()}`;
              const activity = c.unread_messages + c.open_doc_requests;
              const matter = (matterLinks ?? []).find(
                (m) => m.attorney_client_link_id === c.link_id,
              );
              return (
                <tr key={c.link_id} className="att-row">
                  <td className="att-td-tight">
                    <Link to="/clients/$clientId" params={{ clientId: c.client_user_id }}>
                      Client {c.client_user_id.slice(0, 8)}
                    </Link>
                    {sharedBadge && (
                      <span className="att-tag att-badge--navy" style={{ marginLeft: 6 }}>
                        Shared
                      </span>
                    )}
                    {matter && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          marginLeft: 6,
                        }}
                      >
                        <span
                          className="att-tag att-badge--navy"
                          title={matter.clio_matter_description ?? "Linked Clio matter"}
                        >
                          Clio {matter.clio_matter_display_number ?? matter.clio_matter_id}
                        </span>
                        <button
                          className="att-btn-secondary"
                          style={{ fontSize: 11, padding: "1px 6px" }}
                          onClick={async () => {
                            try {
                              await unlinkFn({ data: { attorney_client_link_id: c.link_id } });
                              toast("Clio matter unlinked.");
                              onMatterChange?.();
                            } catch {
                              toast("We couldn't unlink that matter. Try again in a moment.");
                            }
                          }}
                        >
                          Unlink
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="att-td-tight att-mono" style={{ color: "var(--att-text-2)" }}>
                    {caseId}
                  </td>
                  <td className="att-td-tight">
                    <span
                      className="att-tag att-badge--navy"
                      title="Documentation density reflects volume + severity ratings the survivor has logged — not a clinical or forensic risk assessment."
                    >
                      {DENSITY[c.documentation_density]?.label ?? c.documentation_density}
                    </span>
                  </td>
                  <td className="att-td-tight num">{c.incident_count}</td>
                  <td className="att-td-tight num">{c.evidence_count}</td>
                  <td className="att-td-tight num">{c.escalation_flag_count}</td>
                  <td
                    className="att-td-tight num"
                    style={{
                      color: activity ? "var(--att-navy)" : "var(--att-muted)",
                      fontWeight: activity ? 600 : 400,
                    }}
                  >
                    {activity || "—"}
                  </td>
                  <td className="att-td-tight att-mono" style={{ color: "var(--att-text-2)" }}>
                    {fmtDate(c.last_incident_date)}
                  </td>
                  <td className="att-td-tight att-mono" style={{ color: "var(--att-text-2)" }}>
                    {fmtDate(c.linked_at)}
                  </td>
                  <td className="att-td-tight" style={{ textAlign: "right" }}>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: c.client_user_id }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
                    >
                      Open <ArrowRight size={11} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 16, color: "var(--att-text-2)" }}>
                  No matters match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiagnosisCard({ clientCount, tier }: { clientCount: number | null; tier: string }) {
  const tierLabel =
    tier === "firm"
      ? "Firm"
      : tier === "enterprise"
        ? "Enterprise"
        : tier === "solo"
          ? "Solo"
          : "Solo";
  const cap = tier === "firm" || tier === "enterprise" ? "Unlimited" : "5";
  const status = clientCount === null ? "loading" : clientCount === 0 ? "empty" : "active";
  return (
    <div className="att-card" style={{ marginBottom: 24, borderLeft: "4px solid var(--att-navy)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="att-eyebrow">Portal status</div>
          <h2
            style={{
              fontSize: 22,
              margin: "4px 0 6px",
              fontFamily: "var(--font-sans)",
            }}
          >
            {status === "loading" && "Opening your portal…"}
            {status === "empty" && "You're ready. The first invite is the next move."}
            {status === "active" &&
              `${clientCount} client case file${clientCount === 1 ? "" : "s"} active.`}
          </h2>
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
            Plan: <strong>PatternProof {tierLabel}</strong> · Client cap: {cap}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
          <div className="att-eyebrow">What needs attention</div>
          {status === "empty" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Send size={14} style={{ color: "var(--att-blue)" }} />
                <span>Send your first client an invitation link.</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--att-text-2)",
                }}
              >
                <Users size={14} style={{ color: "var(--att-slate)" }} />
                <span>
                  Or import your existing caseload in bulk if you're already representing clients
                  elsewhere.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <CheckCircle2 size={14} style={{ color: "var(--att-green)" }} />
              <span>Open a case file below to begin review.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, v }: { icon: React.ReactNode; label: string; v: number }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--att-slate)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 24, fontFamily: "var(--font-sans)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

/* ---------------- Invite panel ---------------- */

/* ------- Bulk invite panel (CSV upload or paste) ------- */

type BulkRow = {
  survivor_email: string;
  survivor_name?: string | null;
  personal_note?: string | null;
};
type BulkOutcome =
  | { index: number; ok: true; email: string; invite_token: string; id: string }
  | { index: number; ok: false; email: string; error: string };

const MAX_BULK = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(text: string): { rows: BulkRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [], errors: ["File is empty."] };

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  let header: string[] | null = null;
  const firstCells = splitLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = firstCells.includes("survivor_email") || firstCells.includes("email");
  let dataLines = lines;
  if (hasHeader) {
    header = firstCells;
    dataLines = lines.slice(1);
  }

  const idx = (name: string, alt?: string) => {
    if (!header) return name === "survivor_email" ? 0 : name === "survivor_name" ? 1 : 2;
    let i = header.indexOf(name);
    if (i === -1 && alt) i = header.indexOf(alt);
    return i;
  };
  const iEmail = idx("survivor_email", "email");
  const iName = idx("survivor_name", "name");
  const iNote = idx("personal_note", "note");

  const rows: BulkRow[] = [];
  for (const line of dataLines) {
    const cells = splitLine(line);
    const email = (iEmail >= 0 ? cells[iEmail] : cells[0]) ?? "";
    const name = iName >= 0 ? cells[iName] : cells[1];
    const note = iNote >= 0 ? cells[iNote] : cells[2];
    rows.push({
      survivor_email: String(email ?? "").trim(),
      survivor_name: name ? String(name).trim() : null,
      personal_note: note ? String(note).trim() : null,
    });
  }
  if (rows.length > MAX_BULK)
    errors.push(`Only the first ${MAX_BULK} rows will be sent (you provided ${rows.length}).`);
  return { rows: rows.slice(0, MAX_BULK), errors };
}

function BulkInvitePanel({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [results, setResults] = useState<BulkOutcome[] | null>(null);
  const [busy, setBusy] = useState(false);
  const bulkFn = useServerFn(createSurvivorInvitesBulk);

  const preview = () => {
    const { rows, errors } = parseCsv(text);
    setRows(rows);
    setParseErrors(errors);
    setResults(null);
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 1024 * 1024) {
      toast("CSV is too large (max 1 MB).");
      return;
    }
    const t = await f.text();
    setText(t);
    const { rows, errors } = parseCsv(t);
    setRows(rows);
    setParseErrors(errors);
    setResults(null);
  };

  const send = async () => {
    if (rows.length === 0) {
      toast("Add rows to preview before sending.");
      return;
    }
    setBusy(true);
    try {
      // Send the same rows shown in preview so server results map back to the
      // exact original row numbers, including invalid rows that should fail.
      const r = await bulkFn({ data: { rows, expires_days: 30 } });
      setResults(r.results as BulkOutcome[]);
      toast(`${r.sent} invite${r.sent === 1 ? "" : "s"} sent. ${r.failed} failed.`);
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk invite failed.");
    } finally {
      setBusy(false);
    }
  };

  const previewRows = rows.map((r) => ({
    ...r,
    invalid: !EMAIL_RE.test(r.survivor_email) ? "Invalid email" : null,
  }));

  return (
    <div className="att-card" style={{ display: "grid", gap: 12, marginBottom: 14 }}>
      <div>
        <div className="att-eyebrow">Import your existing caseload</div>
        <p style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 4 }}>
          Already representing these clients elsewhere? Import your current caseload in one batch
          instead of inviting people one at a time. Paste CSV rows or upload a .csv. Columns:{" "}
          <code>survivor_email, survivor_name, personal_note</code>. Header row optional. Max{" "}
          {MAX_BULK} rows per batch.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label className="att-btn-ghost" style={{ cursor: "pointer" }}>
          <Upload size={12} /> Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button className="att-btn-ghost" onClick={preview} type="button">
          Preview pasted rows
        </button>
      </div>

      <textarea
        className="att-textarea"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "survivor_email,survivor_name,personal_note\njane@example.com,Jane Doe,Looking forward to working with you\n..."
        }
        style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
      />

      {parseErrors.length > 0 && (
        <div
          style={{
            background: "var(--pp-card)",
            color: "var(--att-text-2)",
            padding: 8,
            borderRadius: 2,
            fontSize: 12,
          }}
        >
          {parseErrors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}

      {previewRows.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid var(--att-border)", borderRadius: 2 }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--att-surface-2)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>#</th>
                <th style={{ textAlign: "left", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", padding: 8 }}>Note</th>
                <th style={{ textAlign: "left", padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, i) => {
                const outcome = results?.find((o) => o.index === i);
                return (
                  <tr
                    key={i}
                    style={{
                      borderTop: "1px solid var(--att-border)",
                      background: r.invalid ? "#FFFFFF" : undefined,
                    }}
                  >
                    <td style={{ padding: 8, color: "var(--att-text-2)" }}>{i + 1}</td>
                    <td style={{ padding: 8 }}>
                      {r.survivor_email || <em style={{ color: "var(--att-text)" }}>missing</em>}
                    </td>
                    <td style={{ padding: 8 }}>{r.survivor_name ?? ""}</td>
                    <td
                      style={{
                        padding: 8,
                        maxWidth: 240,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.personal_note ?? ""}
                    </td>
                    <td style={{ padding: 8 }}>
                      {outcome ? (
                        outcome.ok ? (
                          <span style={{ color: "var(--att-navy)" }}>✓ Sent</span>
                        ) : (
                          <span style={{ color: "var(--att-text)" }}>
                            ✗ Failed · {outcome.error}
                          </span>
                        )
                      ) : results ? (
                        <span style={{ color: "var(--att-text-2)" }}>Pending</span>
                      ) : r.invalid ? (
                        <span style={{ color: "var(--att-text)" }}>{r.invalid}</span>
                      ) : (
                        <span style={{ color: "var(--att-text-2)" }}>Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>
          {previewRows.length > 0
            ? `${previewRows.length} row${previewRows.length === 1 ? "" : "s"} pending. Invalid rows will be returned as failed.`
            : "Add rows to preview."}
        </span>
        <button
          type="button"
          className="att-btn-primary"
          disabled={busy || previewRows.length === 0}
          onClick={send}
        >
          <Send size={13} /> {busy ? "Sending…" : "Send batch"}
        </button>
      </div>
    </div>
  );
}

/* ------- Single invite panel below ------- */

function InvitePanel({ invites, onChange }: { invites: InviteRow[] | null; onChange: () => void }) {
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const create = useServerFn(createSurvivorInvite);
  const revoke = useServerFn(revokeSurvivorInvite);
  const resend = useServerFn(resendSurvivorInvite);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await create({
        data: {
          survivor_email: email.trim(),
          survivor_name: name.trim() || null,
          personal_note: note.trim() || null,
          expires_days: 30,
        },
      });
      toast("Invite sent. Copy the link to share securely.");
      setEmail("");
      setName("");
      setNote("");
      onChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send invite.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/survivor-invite/${token}`;
    navigator.clipboard.writeText(url).then(() => toast("Invite link copied."));
  };

  return (
    <>
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="att-eyebrow">Survivor invites</div>
            <h2
              style={{
                fontSize: 22,
                marginTop: 4,
                fontFamily: "var(--font-sans)",
              }}
            >
              Invite a survivor to share their case
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={mode === "single" && open ? "att-btn-primary" : "att-btn-ghost"}
              onClick={() => {
                setMode("single");
                setOpen(true);
              }}
            >
              <Plus size={14} /> Single invite
            </button>
            <button
              className={mode === "bulk" && open ? "att-btn-primary" : "att-btn-ghost"}
              onClick={() => {
                setMode("bulk");
                setOpen(true);
              }}
            >
              <Users size={14} /> Import caseload
            </button>
            {open && (
              <button className="att-btn-ghost" onClick={() => setOpen(false)}>
                <X size={12} /> Close
              </button>
            )}
          </div>
        </div>

        {open && mode === "single" && (
          <form
            onSubmit={submit}
            className="att-card"
            style={{ display: "grid", gap: 12, marginBottom: 14 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="att-eyebrow">Survivor email *</span>
                <input
                  className="att-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="name@example.com"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="att-eyebrow">Survivor name</span>
                <input
                  className="att-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="Optional"
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="att-eyebrow">Personal note</span>
              <textarea
                className="att-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Shown to the survivor with your invite. Keep it brief and warm."
              />
            </label>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>
                Invite expires in 30 days. They control what they share.
              </span>
              <button type="submit" disabled={saving} className="att-btn-primary">
                <Send size={13} /> {saving ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        )}

        {open && mode === "bulk" && (
          <BulkInvitePanel
            onDone={() => {
              onChange();
            }}
          />
        )}

        {invites === null ? null : invites.length === 0 ? (
          <div
            className="att-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--att-text-2)",
              fontSize: 13,
            }}
          >
            <Mail size={16} style={{ color: "var(--att-slate)" }} />
            No invites sent yet. Send one above to bring a survivor into your portal.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {invites.map((inv) => {
              const s = STATUS_STYLE[inv.effective_status] ?? STATUS_STYLE.pending;
              const link = `${typeof window === "undefined" ? "" : window.location.origin}/survivor-invite/${inv.invite_token}`;
              const isPending = inv.effective_status === "pending";
              const isExpired = inv.effective_status === "expired";
              return (
                <div
                  key={inv.id}
                  className="att-card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                    >
                      <strong style={{ fontSize: 14 }}>
                        {inv.survivor_name || inv.survivor_email}
                      </strong>
                      <span className="att-tag" style={{ background: s.bg, color: s.fg }}>
                        {s.label}
                      </span>
                      {inv.survivor_name && (
                        <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>
                          {inv.survivor_email}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--att-text-2)", marginTop: 4 }}>
                      Sent {new Date(inv.created_at).toLocaleDateString()}
                      {inv.accepted_at && (
                        <> · accepted {new Date(inv.accepted_at).toLocaleDateString()}</>
                      )}
                      {isPending && inv.expires_at && (
                        <> · expires {new Date(inv.expires_at).toLocaleDateString()}</>
                      )}
                    </div>
                    {isPending && (
                      <div
                        className="att-mono"
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: "var(--att-slate)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {link}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {isPending && (
                      <button
                        className="att-btn-ghost"
                        onClick={() => copyLink(inv.invite_token)}
                        title="Copy invite link"
                      >
                        <Copy size={12} /> Copy link
                      </button>
                    )}
                    {(isPending || isExpired) && (
                      <button
                        className="att-btn-ghost"
                        onClick={async () => {
                          try {
                            await resend({ data: { id: inv.id, expires_days: 30 } });
                            toast("Invite reactivated for 30 more days.");
                            onChange();
                          } catch (e) {
                            toast(e instanceof Error ? e.message : "Couldn't resend.");
                          }
                        }}
                      >
                        <RotateCw size={12} /> {isExpired ? "Renew" : "Resend"}
                      </button>
                    )}
                    {(isPending || isExpired) && (
                      <button
                        className="att-btn-ghost"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Revoke this invite?",
                            body: "The survivor will no longer be able to accept.",
                            confirmLabel: "Revoke",
                            cancelLabel: "Keep",
                          });
                          if (!ok) return;
                          try {
                            await revoke({ data: { id: inv.id } });
                            toast("Invite revoked.");
                            onChange();
                          } catch (e) {
                            toast(e instanceof Error ? e.message : "Couldn't revoke.");
                          }
                        }}
                        style={{ color: "var(--att-red)" }}
                      >
                        <X size={12} /> Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {dialog}
    </>
  );
}
