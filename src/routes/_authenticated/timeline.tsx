import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES, typeColor, typeLabel } from "@/lib/abuse-types";
import { formatIncidentDate } from "@/lib/dates";
import { FileText } from "lucide-react";
import { CognitiveClose } from "@/components/CognitiveClose";
import { useServerFn } from "@tanstack/react-start";
import { findCrossReferences, type XrefCluster } from "@/lib/cross-references.functions";

interface Item {
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
interface EvItem { id: string; title: string; file_type: string; file_url: string; linked_incident_id: string | null }
interface LegalItem {
  id: string;
  document_type: string;
  title: string;
  effective_date: string | null;
  incident_date: string | null;
  expiration_date: string | null;
  key_terms: string | null;
  case_number: string | null;
}

const LEGAL_COLOR: Record<string, string> = {
  tro: "#8A5A2E", fro: "#8A5A2E",
  police_report: "#5B4CD6", "911_log": "#5B4CD6",
  custody_order: "#A8D8B9", court_order: "#A8D8B9",
  cps_report: "#D2B48C", hearing_transcript: "#B57E60", other: "#B57E60",
};
const LEGAL_LABEL: Record<string, string> = {
  tro: "TRO", fro: "FRO", police_report: "Police Report", "911_log": "911 Log",
  custody_order: "Custody Order", court_order: "Court Order",
  cps_report: "CPS Report", hearing_transcript: "Hearing Transcript", other: "Document",
};

export const Route = createFileRoute("/_authenticated/timeline")({
  component: TimelinePage,
});

function CorroborationSection({ clusters }: { clusters: XrefCluster[] }) {
  const label = (t: XrefCluster["anchor_type"]) =>
    t === "date" ? "SHARED DATE" : t === "location" ? "SHARED PLACE" : "REPEATED PATTERN";
  return (
    <section className="mt-6" style={{ background: "#F7F5F0", padding: 20, border: "1px solid rgba(20,19,31,0.14)" }}>
      <div className="flex items-baseline gap-3">
        <span className="exhibit-tag">CORROBORATION</span>
        <span className="mono-meta mono-meta--muted">Records that reinforce each other</span>
      </div>
      <p style={{ marginTop: 8, fontSize: 13, color: "rgba(20,19,31,0.65)" }}>
        These entries share a date, place, or repeated pattern. Nothing is flagged as wrong — this
        is where your own records line up.
      </p>
      <div className="mt-4 space-y-3">
        {clusters.slice(0, 12).map((c, i) => (
          <div key={i} className="xref-connector">
            <div>
              <span className="xref-tag">{label(c.anchor_type)}</span>
              <span className="mono-meta">{c.detail}</span>
            </div>
            <ul style={{ marginTop: 6, paddingLeft: 14, listStyle: "square" }}>
              {c.exhibits.map((e) => (
                <li key={e.kind + e.id} style={{ fontSize: 13, color: "#14131F", lineHeight: 1.5 }}>
                  <span className="mono-meta mono-meta--muted" style={{ marginRight: 6 }}>
                    {e.kind.toUpperCase()}
                  </span>
                  {e.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelinePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [evByIncident, setEvByIncident] = useState<Record<string, Array<EvItem & { url?: string }>>>({});
  const [legal, setLegal] = useState<LegalItem[]>([]);
  const [showLegal, setShowLegal] = useState(true);
  const [types, setTypes] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [xrefs, setXrefs] = useState<XrefCluster[]>([]);
  const fetchXrefs = useServerFn(findCrossReferences);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { clusters } = await fetchXrefs();
        setXrefs(clusters);
      } catch { /* silent — corroboration is additive */ }
    })();
  }, [user, fetchXrefs]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("incidents")
        .select("id,date,description,abuse_types,date_precision,date_range_start,date_range_end,anchor_incident_id,anchor_label")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("date", { ascending: false, nullsFirst: false });
      setItems((data as Item[] | null) ?? []);
      const { data: ev } = await supabase
        .from("evidence")
        .select("id,title,file_type,file_url,linked_incident_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .not("linked_incident_id", "is", null);
      const rows = (ev as EvItem[] | null) ?? [];
      const withUrls = await Promise.all(rows.map(async (r) => {
        const { data: signed } = await supabase.storage.from("evidence-files").createSignedUrl(r.file_url, 3600);
        return { ...r, url: signed?.signedUrl };
      }));
      const grouped: Record<string, Array<EvItem & { url?: string }>> = {};
      withUrls.forEach((r) => {
        const k = r.linked_incident_id!;
        (grouped[k] ||= []).push(r);
      });
      setEvByIncident(grouped);
      const { data: ld } = await supabase
        .from("legal_documents")
        .select("id,document_type,title,effective_date,incident_date,expiration_date,key_terms,case_number")
        .eq("user_id", user.id);
      setLegal((ld as LegalItem[] | null) ?? []);
    })();
  }, [user]);

  type Row =
    | { kind: "incident"; date: string; item: Item }
    | { kind: "legal"; date: string; item: LegalItem };

  const filtered = useMemo<Row[]>(() => {
    const inc: Row[] = items.filter((i) => {
      if (types.length && !i.abuse_types.some((t) => types.includes(t))) return false;
      if (from && (i.date ?? "") < from) return false;
      if (to && (i.date ?? "9999") > to) return false;
      return true;
    }).map((i) => ({ kind: "incident", date: i.date ?? "", item: i } as Row));
    const leg: Row[] = showLegal
      ? legal
          .map((l) => ({ ...l, _date: l.effective_date || l.incident_date || "" }))
          .filter((l) => l._date && (!from || l._date >= from) && (!to || l._date <= to))
          .map((l) => ({ kind: "legal", date: l._date, item: l } as Row))
      : [];
    // Chronological first (newest at top). Where two entries share a date, the
    // more certain one reads first — an exact date is a firmer anchor than an
    // approximate or unknown one. Undated entries fall to the bottom.
    const precisionRank = (r: Row) => {
      if (r.kind !== "incident") return 0;
      const p = (r.item as Item).date_precision ?? "exact";
      return p === "exact" ? 0 : p === "approximate" ? 1 : 2;
    };
    return [...inc, ...leg].sort((a, b) => {
      if (!a.date && b.date) return 1;
      if (a.date && !b.date) return -1;
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return precisionRank(a) - precisionRank(b);
    });
  }, [items, legal, showLegal, types, from, to]);

  const toggleType = (v: string) => setTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <div>
      <div className="label-eyebrow">Timeline</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        The pattern, <em>over time.</em>
      </h1>

      {xrefs.length > 0 && <CorroborationSection clusters={xrefs} />}

      <div className="card-pp mt-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="label-eyebrow mb-2">Filter by type</div>
            <div className="flex flex-wrap gap-2">
              {ABUSE_TYPES.map((t) => {
                const on = types.includes(t.value);
                return (
                  <button key={t.value} onClick={() => toggleType(t.value)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ background: on ? t.color : "transparent", color: on ? "#fff" : "var(--foreground)", border: `1.5px solid ${t.color}` }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label-eyebrow mb-1">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-pp" />
          </div>
          <div>
            <div className="label-eyebrow mb-1">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-pp" />
          </div>
          <label className="flex items-center gap-2 self-center text-[12px]">
            <input type="checkbox" checked={showLegal} onChange={(e) => setShowLegal(e.target.checked)} />
            Include legal documents
          </label>
        </div>
      </div>

      <div className="relative mt-8 pl-8">
        <div className="absolute left-2 top-0 bottom-0" style={{ width: 2, background: "var(--accent)" }} />
        {filtered.length === 0 ? (
          <div className="card-pp">
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              Your timeline will take shape as you add records. Every entry matters.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((row) => {
              if (row.kind === "legal") {
                const l = row.item;
                const color = LEGAL_COLOR[l.document_type] ?? "#B57E60";
                return (
                  <div key={`l-${l.id}`} className="relative">
                    <span className="absolute -left-[28px] top-3 flex h-4 w-4 items-center justify-center rounded-sm ring-4" style={{ background: color, boxShadow: "0 0 0 4px var(--background)" }}>
                      <FileText size={10} color="#14131F" />
                    </span>
                    <div className="card-pp" style={{ borderLeft: `3px solid ${color}` }}>
                      <div className="font-serif italic text-[16px]">
                        {new Date(row.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="mt-1">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: color, color: "#14131F" }}>
                          {LEGAL_LABEL[l.document_type] ?? "Document"}
                        </span>
                      </div>
                      <p className="mt-2 font-serif text-[15px]">{l.title}</p>
                      {l.case_number && (
                        <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>Case #{l.case_number}</div>
                      )}
                      {l.key_terms && (
                        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--foreground)" }}>{l.key_terms}</p>
                      )}
                    </div>
                  </div>
                );
              }
              const i = row.item;
              // Build anchor lookup so "Before/After [linked incident]" can render.
              const anchor = i.anchor_incident_id ? items.find((x) => x.id === i.anchor_incident_id) : null;
              const open = expanded[i.id];
              const primary = i.abuse_types[0] ?? "other";
              const long = i.description.length > 160;
              return (
                <div key={`i-${i.id}`} className="relative">
                  <span className="absolute -left-[26px] top-3 h-3.5 w-3.5 rounded-full ring-4" style={{ background: typeColor(primary), boxShadow: "0 0 0 4px var(--background)" }} />
                  <div className="card-pp" style={{ borderLeft: `3px solid ${typeColor(primary)}` }}>
                    <div className="font-serif italic text-[16px]">
                      {formatIncidentDate({ ...i, anchor_incident: anchor ? { date: anchor.date, description: anchor.description } : null })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {i.abuse_types.map((t) => (
                        <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: typeColor(t), color: "#1A1714" }}>{typeLabel(t)}</span>
                      ))}
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
                      {open || !long ? i.description : i.description.slice(0, 160) + "…"}
                    </p>
                    {long && (
                      <button className="mt-1 text-[12px] font-semibold" style={{ color: "var(--accent)" }} onClick={() => setExpanded((p) => ({ ...p, [i.id]: !open }))}>
                        {open ? "Show less" : "Read more"}
                      </button>
                    )}
                    {evByIncident[i.id]?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {evByIncident[i.id].map((e) => (
                          <a key={e.id} href={e.url} target="_blank" rel="noreferrer"
                            className="block overflow-hidden rounded-lg" style={{ width: 88, background: "var(--input)", border: "1px solid var(--border)" }}>
                            {e.file_type === "image" && e.url ? (
                              <img src={e.url} alt={e.title} className="h-16 w-full object-cover" />
                            ) : (
                              <div className="flex h-16 items-center justify-center text-[10px]" style={{ color: "var(--muted-foreground)" }}>{e.file_type}</div>
                            )}
                            <div className="px-1.5 py-1 text-[10px] leading-tight" style={{ color: "var(--foreground)" }}>{e.title.slice(0, 22)}</div>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <CognitiveClose
        title="See what the pattern is telling you"
        body="Once your timeline has a few entries, our pattern view surfaces escalation and recurring tactics."
        cta="View patterns"
        to="/patterns"
      />
    </div>
  );
}