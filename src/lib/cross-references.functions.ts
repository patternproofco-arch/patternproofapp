import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeName } from "@/lib/name-match";

/**
 * Cross-reference detection (a.k.a. "Corroboration" survivor-facing,
 * "Cross-reference" attorney-facing). Fully deterministic — no AI, no ML.
 *
 * Groups the survivor's records into clusters that share at least one of:
 *   - date anchor       (exact same date, OR overlapping ≤3-day windows,
 *                        OR one incident's anchor_incident_id points at
 *                        the other)
 *   - location anchor   (normalized location strings match exactly, OR
 *                        share ≥2 significant tokens of ≥4 chars)
 *   - escalation anchor (share ≥1 abuse_types value AND their dates are
 *                        within a 14-day rolling window)
 *
 * Sources included:
 *   - incidents
 *   - evidence           (via linked_incident_id, inherits anchors)
 *   - communications     (own date + linked_incident_id)
 *   - legal_documents    (effective_date / incident_date)
 *
 * Only confirmed records for the survivor view; the attorney view respects
 * whatever link-level scoping is applied upstream.
 */

export type ExhibitKind = "incident" | "evidence" | "communication" | "legal";

export interface XrefExhibit {
  id: string;
  kind: ExhibitKind;
  date: string | null;
  label: string;
}

export interface XrefCluster {
  anchor_type: "date" | "location" | "escalation";
  detail: string;
  exhibits: XrefExhibit[];
}

const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "our", "his", "her",
  "street", "st", "ave", "avenue", "road", "rd", "apt", "apartment",
  "unit", "suite", "north", "south", "east", "west",
]);

function tokenize(loc: string): string[] {
  const norm = normalizeName(loc);
  if (!norm) return [];
  return norm
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

function daysBetween(a: string, b: string): number {
  const ad = new Date(a + "T00:00:00Z").getTime();
  const bd = new Date(b + "T00:00:00Z").getTime();
  if (!Number.isFinite(ad) || !Number.isFinite(bd)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((ad - bd) / (1000 * 60 * 60 * 24)));
}

function fmtDate(d: string | null): string {
  if (!d) return "date unknown";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

interface RawIncident {
  id: string;
  date: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  anchor_incident_id: string | null;
  location: string | null;
  abuse_types: string[];
  description: string;
  source?: string | null;
  confirmed_at?: string | null;
}
interface RawEvidence { id: string; title: string; date: string | null; linked_incident_id: string | null }
interface RawComm { id: string; date: string | null; content: string | null; linked_incident_id: string | null }
interface RawLegal { id: string; title: string; effective_date: string | null; incident_date: string | null }

interface ExhibitNode extends XrefExhibit {
  location: string | null;
  abuse_types: string[];
  range_start: string | null;
  range_end: string | null;
  anchor_id: string | null;
}

export function computeCrossReferences(
  incidents: RawIncident[],
  evidence: RawEvidence[],
  comms: RawComm[],
  legal: RawLegal[],
): XrefCluster[] {
  const incById = new Map(incidents.map((i) => [i.id, i]));
  const nodes: ExhibitNode[] = [];

  for (const i of incidents) {
    nodes.push({
      id: i.id,
      kind: "incident",
      date: i.date,
      label: (i.description || "").trim().slice(0, 80) || "Incident",
      location: i.location,
      abuse_types: i.abuse_types || [],
      range_start: i.date_range_start,
      range_end: i.date_range_end,
      anchor_id: i.anchor_incident_id,
    });
  }
  for (const e of evidence) {
    const parent = e.linked_incident_id ? incById.get(e.linked_incident_id) : null;
    nodes.push({
      id: e.id,
      kind: "evidence",
      date: e.date || parent?.date || null,
      label: e.title || "Evidence",
      location: parent?.location ?? null,
      abuse_types: parent?.abuse_types ?? [],
      range_start: parent?.date_range_start ?? null,
      range_end: parent?.date_range_end ?? null,
      anchor_id: e.linked_incident_id,
    });
  }
  for (const c of comms) {
    const parent = c.linked_incident_id ? incById.get(c.linked_incident_id) : null;
    nodes.push({
      id: c.id,
      kind: "communication",
      date: c.date || parent?.date || null,
      label: (c.content || "").trim().slice(0, 80) || "Message",
      location: parent?.location ?? null,
      abuse_types: parent?.abuse_types ?? [],
      range_start: parent?.date_range_start ?? null,
      range_end: parent?.date_range_end ?? null,
      anchor_id: c.linked_incident_id,
    });
  }
  for (const l of legal) {
    nodes.push({
      id: l.id,
      kind: "legal",
      date: l.effective_date || l.incident_date || null,
      label: l.title || "Document",
      location: null,
      abuse_types: [],
      range_start: null,
      range_end: null,
      anchor_id: null,
    });
  }

  // ---------- Date clusters (exact / overlap ≤3d / anchor pointer) ----------
  const dateClusters = new Map<string, ExhibitNode[]>();
  for (const n of nodes) {
    if (!n.date && !n.range_start) continue;
    if (n.date) {
      const arr = dateClusters.get(n.date) ?? [];
      arr.push(n);
      dateClusters.set(n.date, arr);
    }
  }
  const dateOut: XrefCluster[] = [];
  for (const [d, group] of dateClusters) {
    if (group.length < 2) continue;
    dateOut.push({
      anchor_type: "date",
      detail: `All on ${fmtDate(d)}`,
      exhibits: group.map((g) => ({ id: g.id, kind: g.kind, date: g.date, label: g.label })),
    });
  }
  // Anchor-pointer clusters (incident.anchor_incident_id)
  for (const n of nodes) {
    if (!n.anchor_id) continue;
    const anchor = nodes.find((x) => x.kind === "incident" && x.id === n.anchor_id);
    if (!anchor) continue;
    // Avoid duplicating pure same-date clusters
    if (anchor.date && n.date && anchor.date === n.date) continue;
    dateOut.push({
      anchor_type: "date",
      detail: `Anchored: near ${fmtDate(anchor.date)}`,
      exhibits: [
        { id: anchor.id, kind: anchor.kind, date: anchor.date, label: anchor.label },
        { id: n.id, kind: n.kind, date: n.date, label: n.label },
      ],
    });
  }
  // Range-overlap ≤3 days (only between two ranged incidents)
  const ranged = nodes.filter((n) => n.range_start && n.range_end);
  for (let i = 0; i < ranged.length; i++) {
    for (let j = i + 1; j < ranged.length; j++) {
      const a = ranged[i], b = ranged[j];
      const aStart = new Date(a.range_start! + "T00:00:00Z").getTime();
      const aEnd = new Date(a.range_end! + "T00:00:00Z").getTime();
      const bStart = new Date(b.range_start! + "T00:00:00Z").getTime();
      const bEnd = new Date(b.range_end! + "T00:00:00Z").getTime();
      const gap = Math.max(0, Math.max(aStart, bStart) - Math.min(aEnd, bEnd));
      if (gap / (1000 * 60 * 60 * 24) <= 3) {
        dateOut.push({
          anchor_type: "date",
          detail: "Overlapping date windows",
          exhibits: [
            { id: a.id, kind: a.kind, date: a.date, label: a.label },
            { id: b.id, kind: b.kind, date: b.date, label: b.label },
          ],
        });
      }
    }
  }

  // ---------- Location clusters ----------
  const locGroups = new Map<string, ExhibitNode[]>();
  const withLoc = nodes.filter((n) => n.location && normalizeName(n.location));
  for (const n of withLoc) {
    const key = normalizeName(n.location!) as string;
    const arr = locGroups.get(key) ?? [];
    arr.push(n);
    locGroups.set(key, arr);
  }
  const locOut: XrefCluster[] = [];
  for (const [key, group] of locGroups) {
    if (group.length < 2) continue;
    const label = group[0].location || key;
    locOut.push({
      anchor_type: "location",
      detail: `Same place: “${label}”`,
      exhibits: group.map((g) => ({ id: g.id, kind: g.kind, date: g.date, label: g.label })),
    });
  }
  // Token-overlap (≥2 significant tokens) — pairwise, dedup against exact key match
  const seenLocPair = new Set<string>();
  for (const [k, group] of locGroups) {
    for (const g of group) seenLocPair.add(k + "|" + g.id);
  }
  for (let i = 0; i < withLoc.length; i++) {
    for (let j = i + 1; j < withLoc.length; j++) {
      const a = withLoc[i], b = withLoc[j];
      const ta = new Set(tokenize(a.location!));
      const tb = tokenize(b.location!);
      const shared = tb.filter((t) => ta.has(t));
      if (shared.length < 2) continue;
      if (normalizeName(a.location!) === normalizeName(b.location!)) continue;
      locOut.push({
        anchor_type: "location",
        detail: `Similar place (${shared.slice(0, 2).join(", ")})`,
        exhibits: [
          { id: a.id, kind: a.kind, date: a.date, label: a.label },
          { id: b.id, kind: b.kind, date: b.date, label: b.label },
        ],
      });
    }
  }

  // ---------- Escalation clusters (shared type + within 14 days) ----------
  const escOut: XrefCluster[] = [];
  const dated = nodes.filter((n) => n.date && n.abuse_types.length > 0 && n.kind === "incident");
  const escGroups = new Map<string, Array<{ n: ExhibitNode; type: string }>>();
  for (const n of dated) {
    for (const t of n.abuse_types) {
      const arr = escGroups.get(t) ?? [];
      arr.push({ n, type: t });
      escGroups.set(t, arr);
    }
  }
  for (const [type, arr] of escGroups) {
    const sorted = arr
      .slice()
      .sort((a, b) => (a.n.date! < b.n.date! ? -1 : 1));
    let cluster: ExhibitNode[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (cluster.length === 0) {
        cluster.push(sorted[i].n);
        continue;
      }
      const last = cluster[cluster.length - 1];
      if (daysBetween(last.date!, sorted[i].n.date!) <= 14) {
        cluster.push(sorted[i].n);
      } else {
        if (cluster.length >= 2) {
          const first = cluster[0].date!;
          const end = cluster[cluster.length - 1].date!;
          escOut.push({
            anchor_type: "escalation",
            detail: `${type} · ${cluster.length}× between ${fmtDate(first)} – ${fmtDate(end)}`,
            exhibits: cluster.map((g) => ({ id: g.id, kind: g.kind, date: g.date, label: g.label })),
          });
        }
        cluster = [sorted[i].n];
      }
    }
    if (cluster.length >= 2) {
      const first = cluster[0].date!;
      const end = cluster[cluster.length - 1].date!;
      escOut.push({
        anchor_type: "escalation",
        detail: `${type} · ${cluster.length}× between ${fmtDate(first)} – ${fmtDate(end)}`,
        exhibits: cluster.map((g) => ({ id: g.id, kind: g.kind, date: g.date, label: g.label })),
      });
    }
  }

  return [...dateOut, ...locOut, ...escOut];
}

export const findCrossReferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ clusters: XrefCluster[] }> => {
    const { supabase, userId } = context;
    const [inc, ev, cm, lg] = await Promise.all([
      supabase
        .from("incidents")
        .select("id,date,date_range_start,date_range_end,anchor_incident_id,location,abuse_types,description,source,confirmed_at")
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabase
        .from("evidence")
        .select("id,title,date,linked_incident_id")
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabase
        .from("communications")
        .select("id,date,content,linked_incident_id")
        .eq("user_id", userId),
      supabase
        .from("legal_documents")
        .select("id,title,effective_date,incident_date")
        .eq("user_id", userId),
    ]);
    // Survivor view: only include confirmed records.
    const incidents = ((inc.data as RawIncident[] | null) ?? []).filter(
      (i) => !(i.source === "ai_extracted" && !i.confirmed_at),
    );
    const clusters = computeCrossReferences(
      incidents,
      (ev.data as RawEvidence[] | null) ?? [],
      (cm.data as RawComm[] | null) ?? [],
      (lg.data as RawLegal[] | null) ?? [],
    );
    return { clusters };
  });