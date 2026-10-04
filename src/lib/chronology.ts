/**
 * Attorney-facing factual chronology and declaration draft (pure, deterministic).
 *
 * No AI writes anything here. Every sentence is either the client's own words
 * (quoted in full, never truncated inside quotation marks), a fixed template, or
 * text the attorney typed.
 *
 * What this will not do:
 *  - invent or "clean up" facts, dates or quotes;
 *  - turn an uncertain date into a certain one, or an upload date into an event date;
 *  - characterize anything ("abuse", "threat", "harassment" never appear in text
 *    PatternProof writes; they appear only inside the client's own quoted words);
 *  - add a newly shared item to a draft by itself;
 *  - show text from an item that is no longer shared;
 *  - label a draft as signed, sworn, verified, authentic or admissible.
 */

import {
  changeMarker,
  itemKey,
  labelExhibits,
  type ExhibitKind,
  type ExhibitLabel,
  type ExhibitPackage,
  type ItemRef,
} from "@/lib/exhibit-numbering";

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

// ---------------------------------------------------------------------------
// Dates, kept as honest as they were recorded
// ---------------------------------------------------------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-03-03" -> "March 3, 2026". No Date object, so no time-zone shift. */
export function formatDay(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

function formatMonth(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : null;
}

export type DateInfo = {
  /** YYYY-MM-DD used only to order rows. Null when the position is not a date. */
  sortDate: string | null;
  /** The date as it should be read, uncertainty included. */
  text: string;
  /** Lead-in for a sentence ("On March 3, 2026", "In or around March 2026"). */
  lead: string;
  certainty: "exact" | "approximate" | "range" | "relative" | "unknown";
};

export function describeDate(row: Row, anchorFallback = "a related event"): DateInfo {
  const precision = str(row.date_precision) ?? "exact";
  const date = str(row.date);
  const start = str(row.date_range_start);
  const end = str(row.date_range_end);
  const anchor = str(row.anchor_label) ?? anchorFallback;

  switch (precision) {
    case "approximate_month":
    case "approximate": {
      const t = formatMonth(date ?? start) ?? null;
      if (!t) break;
      return {
        sortDate: (date ?? start)!.slice(0, 10),
        text: `${t} (approximate; exact day not known)`,
        lead: `In or around ${t}`,
        certainty: "approximate",
      };
    }
    case "range": {
      const a = formatDay(start);
      const b = formatDay(end);
      if (a && b) {
        return {
          sortDate: start!.slice(0, 10),
          text: `Between ${a} and ${b} (exact day not known)`,
          lead: `Sometime between ${a} and ${b}`,
          certainty: "range",
        };
      }
      if (a || b) {
        const only = (a ?? b)!;
        const which = a ? "on or after" : "on or before";
        return {
          sortDate: (start ?? end)!.slice(0, 10),
          text: `${which[0]!.toUpperCase()}${which.slice(1)} ${only} (other end not known)`,
          lead: `Sometime ${which} ${only}`,
          certainty: "range",
        };
      }
      break;
    }
    case "before_anchor":
      return {
        sortDate: null,
        text: `Before ${anchor} (no calendar date given)`,
        lead: `Before ${anchor}`,
        certainty: "relative",
      };
    case "after_anchor":
      return {
        sortDate: null,
        text: `After ${anchor} (no calendar date given)`,
        lead: `After ${anchor}`,
        certainty: "relative",
      };
    case "unknown":
      return { sortDate: null, text: "Date not known", lead: "On a date the client did not record", certainty: "unknown" };
    default:
      break;
  }
  const exact = formatDay(date);
  if (exact) return { sortDate: date!.slice(0, 10), text: exact, lead: `On ${exact}`, certainty: "exact" };
  return { sortDate: null, text: "Date not known", lead: "On a date the client did not record", certainty: "unknown" };
}

function formatTime(t: string | null): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type Basis = "client_entry" | "client_file" | "client_answer";

export const BASIS_LABEL: Record<Basis, string> = {
  client_entry: "Client's own entry",
  client_file: "File the client uploaded",
  client_answer: "Client's answer to a document request",
};

export type MachineText = {
  kind: "transcript" | "extracted_text";
  text: string;
  /** True only if the record says someone checked it. */
  checked: boolean;
};

export type ChronologyRow = {
  key: string;
  kind: ExhibitKind;
  id: string;
  date: DateInfo;
  /** Time as typed. Time zone is not recorded, and the row says so. */
  timeText: string | null;
  /** When the client entered or uploaded it. Never used as the event date. */
  enteredOn: string | null;
  basis: Basis;
  title: string;
  /** The client's own words, complete and exact. */
  quote: string | null;
  location: string | null;
  witnesses: string | null;
  machineText: MachineText | null;
  exhibit: ExhibitLabel;
  /** Files linked to this entry that are also shared. */
  relatedKeys: string[];
  flags: string[];
  marker: string;
  /** Position tie-breaker only. */
  _order: number;
};

function enteredOn(row: Row): string | null {
  return str(row.created_at)?.slice(0, 10) ?? null;
}

function incidentMarker(i: Row) {
  return changeMarker([
    i.title,
    i.date,
    i.date_precision,
    i.date_range_start,
    i.date_range_end,
    i.anchor_label,
    i.time,
    i.location,
    i.description,
    i.witnesses,
    i.is_draft ? "draft" : "",
    i.confirmed_at,
  ]);
}

function evidenceMarker(e: Row) {
  return changeMarker([
    e.title,
    e.date,
    e.date_precision,
    e.date_range_start,
    e.date_range_end,
    e.description,
    e.transcript,
    e.extracted_text,
    e.sha256,
    e.event_at,
  ]);
}

function requestMarker(r: Row) {
  return changeMarker([r.title, r.submitted_at, r.response_note, r.status]);
}

/** The ref list a package is made from (key, kind, sort date, change marker). */
export function itemRefs(incidents: Row[], evidence: Row[], requests: Row[]): ItemRef[] {
  const refs: ItemRef[] = [];
  for (const i of incidents)
    refs.push({
      key: itemKey("incident", String(i.id)),
      kind: "incident",
      date: describeDate(i).sortDate,
      marker: incidentMarker(i),
    });
  for (const e of evidence)
    refs.push({
      key: itemKey("evidence", String(e.id)),
      kind: "evidence",
      date: describeDate(evidenceDateSource(e)).sortDate,
      marker: evidenceMarker(e),
    });
  for (const r of requests) {
    if (r.status !== "submitted") continue;
    refs.push({
      key: itemKey("request", String(r.id)),
      kind: "request",
      date: str(r.submitted_at)?.slice(0, 10) ?? null,
      marker: requestMarker(r),
    });
  }
  return refs;
}

/**
 * An uploaded file's own date is the date the client gave. If there is none we do
 * NOT fall back to the upload date as if it were the event date. File metadata may
 * suggest one; that is shown as such, never as the client's statement.
 */
function evidenceDateSource(e: Row): Row {
  if (str(e.date) || str(e.date_range_start)) return e;
  const meta = str(e.event_at)?.slice(0, 10);
  if (meta) return { ...e, date: meta, date_precision: "exact", _fromMetadata: true };
  return { ...e, date: null, date_precision: "unknown" };
}

export function buildChronology(
  incidents: Row[],
  evidence: Row[],
  requests: Row[],
  pkg: ExhibitPackage | null,
): ChronologyRow[] {
  const refs = itemRefs(incidents, evidence, requests);
  const labels = labelExhibits(refs, pkg);
  const linked = new Map<string, string[]>();
  for (const e of evidence) {
    const inc = str(e.linked_incident_id);
    if (!inc) continue;
    const k = itemKey("incident", inc);
    linked.set(k, [...(linked.get(k) ?? []), itemKey("evidence", String(e.id))]);
  }
  const live = new Set(refs.map((r) => r.key));

  const rows: ChronologyRow[] = [];
  let n = 0;

  for (const i of incidents) {
    const key = itemKey("incident", String(i.id));
    const date = describeDate(i);
    const flags: string[] = [];
    if (date.certainty !== "exact") flags.push(date.certainty === "unknown" ? "Date not known" : "Date is not exact");
    if (date.certainty === "relative")
      flags.push("Placed by sort order only. Its position is not a finding of when it happened.");
    if (i.source === "ai_extracted")
      flags.push(
        `Drafted by software from the client's material; confirmed by the client${str(i.confirmed_at) ? ` on ${formatDay(str(i.confirmed_at)!.slice(0, 10)) ?? "a recorded date"}` : ""}.`,
      );
    if (i.is_draft) flags.push("The client marked this entry as a draft.");
    rows.push({
      key,
      kind: "incident",
      id: String(i.id),
      date,
      timeText: formatTime(str(i.time)),
      enteredOn: enteredOn(i),
      basis: "client_entry",
      title: str(i.title) ?? str(i.location) ?? "Untitled entry",
      quote: str(i.description),
      location: str(i.location),
      witnesses: str(i.witnesses),
      machineText: null,
      exhibit: labels.get(key)!,
      relatedKeys: (linked.get(key) ?? []).filter((k) => live.has(k)),
      flags,
      marker: incidentMarker(i),
      _order: n++,
    });
  }

  for (const e of evidence) {
    const key = itemKey("evidence", String(e.id));
    const src = evidenceDateSource(e);
    const date = describeDate(src);
    const flags: string[] = [];
    if (src._fromMetadata)
      flags.push(
        "The client gave no date. This date comes from the file's own metadata, which the client has not confirmed and which can be wrong or changed.",
      );
    else if (date.certainty === "unknown")
      flags.push("The client gave no date for this file. Its upload date is shown separately and is not the date of the event.");
    else if (date.certainty !== "exact") flags.push("Date is not exact");
    if (str(e.parent_evidence_id) || str(e.derivative_kind))
      flags.push("A copy made from an original file. The original is kept separately.");
    const machine: MachineText | null = str(e.transcript)
      ? { kind: "transcript", text: str(e.transcript)!, checked: !!e.transcript_verified_at }
      : str(e.extracted_text)
        ? { kind: "extracted_text", text: str(e.extracted_text)!, checked: !!e.extraction_verified_at }
        : null;
    if (machine && !machine.checked)
      flags.push("Text in this file was read by software and has not been checked against the original.");
    rows.push({
      key,
      kind: "evidence",
      id: String(e.id),
      date,
      timeText: null,
      enteredOn: enteredOn(e),
      basis: "client_file",
      title: str(e.title) ?? "Untitled file",
      quote: str(e.description),
      location: null,
      witnesses: null,
      machineText: machine,
      exhibit: labels.get(key)!,
      relatedKeys: [],
      flags,
      marker: evidenceMarker(e),
      _order: n++,
    });
  }

  for (const r of requests) {
    if (r.status !== "submitted") continue;
    const key = itemKey("request", String(r.id));
    const day = str(r.submitted_at)?.slice(0, 10) ?? null;
    rows.push({
      key,
      kind: "request",
      id: String(r.id),
      date: day
        ? { sortDate: day, text: formatDay(day) ?? day, lead: `On ${formatDay(day) ?? day}`, certainty: "exact" }
        : { sortDate: null, text: "Date not known", lead: "On a date not recorded", certainty: "unknown" },
      timeText: null,
      enteredOn: day,
      basis: "client_answer",
      title: str(r.title) ?? "Document request",
      quote: str(r.response_note),
      location: null,
      witnesses: null,
      machineText: null,
      exhibit: labels.get(key)!,
      relatedKeys: [],
      flags: [],
      marker: requestMarker(r),
      _order: n++,
    });
  }

  // Dated rows in date order; rows with no calendar position last. Ties keep input order.
  rows.sort((a, b) => {
    if (a.date.sortDate !== b.date.sortDate) {
      if (a.date.sortDate === null) return 1;
      if (b.date.sortDate === null) return -1;
      return a.date.sortDate < b.date.sortDate ? -1 : 1;
    }
    return a._order - b._order;
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Declaration draft
// ---------------------------------------------------------------------------

export type DeclarationContent = {
  title: string;
  /** Typed by the attorney. Never taken from the survivor's profile. */
  declarantName: string | null;
  /** Items the attorney chose, in order. Nothing is added automatically. */
  included: string[];
  /** Items the attorney looked at and chose not to include. */
  declined: string[];
  /** Attorney-edited paragraph text per item. The survivor's record is never touched. */
  overrides: Record<string, string>;
  /** The change marker each included item had when the attorney last reviewed it. */
  reviewed: Record<string, string>;
  /** Paragraphs the attorney wrote. */
  added: Array<{ id: string; text: string; afterKey: string | null }>;
  /** Exhibit package version this draft cites, or null while exhibits are provisional. */
  packageVersion: number | null;
};

export const EMPTY_DECLARATION: DeclarationContent = {
  title: "Draft factual declaration",
  declarantName: null,
  included: [],
  declined: [],
  overrides: {},
  reviewed: {},
  added: [],
  packageVersion: null,
};

export const DRAFT_BANNER = [
  "UNSIGNED, UNSWORN DRAFT. Prepared for attorney review.",
  "This is not a declaration or affidavit until the attorney has reviewed and edited it and the declarant has reviewed it, agreed that it is accurate, and signed it in the form the court requires.",
  "Whether each statement is within the declarant's personal knowledge is for the attorney and the declarant to decide. Paragraphs generated here only restate what the client recorded.",
];

export const SIGNATURE_PLACEHOLDER = [
  "[Signature block and any oath or perjury language required by the court go here. Added by the attorney. Not generated.]",
];

const q = (s: string) => `“${s}”`;

/** Generated text for one row. Complete quotes only. */
export function generatedParagraph(r: ChronologyRow): string {
  const when = r.date.lead + (r.timeText ? `, at about ${r.timeText} (time as entered; time zone not recorded)` : "");
  const ref = ` See ${r.exhibit.label}${r.exhibit.status === "provisional" ? " (provisional number)" : ""}.`;
  const parts: string[] = [];
  if (r.kind === "incident") {
    parts.push(
      r.quote
        ? `${when}, the client's own entry titled ${q(r.title)} states: ${q(r.quote)}`
        : `${when}, the client made an entry titled ${q(r.title)}. The entry has no description text.`,
    );
    if (r.location) parts.push(`The entry gives the location as: ${q(r.location)}.`);
    if (r.witnesses) parts.push(`The entry lists these witnesses: ${q(r.witnesses)}.`);
  } else if (r.kind === "evidence") {
    parts.push(
      `${when}, the client uploaded a file titled ${q(r.title)}.` +
        (r.quote ? ` The client's description of the file states: ${q(r.quote)}` : " The client gave no description."),
    );
  } else {
    parts.push(
      `${when}, the client answered a document request titled ${q(r.title)}.` +
        (r.quote ? ` The answer states: ${q(r.quote)}` : " The answer has no text."),
    );
  }
  return `${parts.join(" ")}${ref}`;
}

export type DraftParagraph = {
  n: number;
  key: string | null;
  origin: "generated" | "edited" | "attorney_added";
  text: string;
  exhibit: string | null;
  basis: string;
  flags: string[];
  /** Set only on paragraphs the attorney wrote, so they can be edited or removed by id. */
  addedId?: string;
};

export type DraftAnalysis = {
  /** New since the attorney last decided: not included and not declined. */
  needsDecision: string[];
  /** Included items whose source changed after the attorney reviewed it. */
  changedSinceReview: string[];
  /** Included items no longer shared. Their text is hidden everywhere. */
  withdrawn: string[];
  /** Included items still on provisional or no exhibit numbers. */
  uncitedExhibits: string[];
  /** Draft cites an older package version than the current one. */
  packageBehind: boolean;
};

export function analyzeDraft(
  content: DeclarationContent,
  rows: readonly ChronologyRow[],
  pkg: ExhibitPackage | null,
): DraftAnalysis {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const decided = new Set([...content.included, ...content.declined]);
  return {
    needsDecision: rows.filter((r) => !decided.has(r.key)).map((r) => r.key),
    changedSinceReview: content.included.filter((k) => {
      const r = byKey.get(k);
      return !!r && content.reviewed[k] !== r.marker;
    }),
    withdrawn: content.included.filter((k) => !byKey.has(k)),
    uncitedExhibits: content.included.filter((k) => {
      const r = byKey.get(k);
      return !!r && r.exhibit.status !== "numbered";
    }),
    packageBehind: pkg ? (content.packageVersion ?? 0) < pkg.version : false,
  };
}

export function buildDraftParagraphs(
  content: DeclarationContent,
  rows: readonly ChronologyRow[],
): DraftParagraph[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out: Omit<DraftParagraph, "n">[] = [];
  const addedAfter = (key: string | null) =>
    content.added
      .filter((a) => a.afterKey === key)
      .map<Omit<DraftParagraph, "n">>((a) => ({
        key: null,
        origin: "attorney_added",
        text: a.text,
        exhibit: null,
        basis: "Written by the attorney",
        flags: [],
        addedId: a.id,
      }));
  out.push(...addedAfter(null));
  for (const key of content.included) {
    const r = byKey.get(key);
    // Gone from what is shared: say so, show nothing from it.
    if (!r) {
      out.push({
        key,
        origin: "generated",
        text: "[A source for this paragraph is no longer shared with you. Its text is hidden. Remove or replace this paragraph.]",
        exhibit: null,
        basis: "Source no longer shared",
        flags: ["Source no longer shared"],
      });
      out.push(...addedAfter(key));
      continue;
    }
    const edited = content.overrides[key];
    const flags: string[] = [];
    if (content.reviewed[key] !== r.marker)
      flags.push(
        edited
          ? "The source changed after you reviewed it. Your edited text may no longer match it."
          : "The source changed after you reviewed it. This text was regenerated from the current record.",
      );
    out.push({
      key,
      origin: edited ? "edited" : "generated",
      text: edited ?? generatedParagraph(r),
      exhibit: r.exhibit.label,
      basis: BASIS_LABEL[r.basis],
      flags,
    });
    out.push(...addedAfter(key));
  }
  return out.map((p, i) => ({ ...p, n: i + 1 }));
}

/** Plain text for copying. Attorney notes are never part of it. */
export function renderDeclarationText(
  content: DeclarationContent,
  rows: readonly ChronologyRow[],
  pkg: ExhibitPackage | null,
): string {
  const paragraphs = buildDraftParagraphs(content, rows);
  const analysis = analyzeDraft(content, rows, pkg);
  const lines: string[] = [...DRAFT_BANNER.map((l) => l), ""];
  if (!pkg) lines.push("Exhibit numbers in this draft are PROVISIONAL and may change. Freeze them before citing.", "");
  else if (analysis.packageBehind)
    lines.push(`This draft cites exhibit package v${content.packageVersion ?? "?"}; a newer package exists.`, "");
  lines.push(content.title, "");
  lines.push(
    `I, ${content.declarantName?.trim() || "[declarant]"}, state:`,
    "",
  );
  for (const p of paragraphs) lines.push(`${p.n}. ${p.text}`, "");
  lines.push(...SIGNATURE_PLACEHOLDER);
  return lines.join("\n");
}

/** One row as plain text (also used for the text page of a non-file exhibit). */
export function renderChronologyRow(r: ChronologyRow, index?: number): string[] {
  const lines: string[] = [];
  lines.push(
    `${index !== undefined ? `${index}. ` : ""}${r.date.text}${r.timeText ? `, ${r.timeText} (time as entered; time zone not recorded)` : ""} | ${BASIS_LABEL[r.basis]} | ${r.exhibit.label}`,
  );
  lines.push(`   Title as entered: ${q(r.title)}`);
  if (r.quote) lines.push(`   Text as entered: ${q(r.quote)}`);
  if (r.location) lines.push(`   Location as entered: ${q(r.location)}`);
  if (r.witnesses) lines.push(`   Witnesses as entered: ${q(r.witnesses)}`);
  if (r.enteredOn) lines.push(`   Entered by the client on ${formatDay(r.enteredOn) ?? r.enteredOn} (not the date of the event)`);
  for (const f of r.flags) lines.push(`   Note: ${f}`);
  return lines;
}

export function renderChronologyText(rows: readonly ChronologyRow[]): string {
  const lines = [
    "FACTUAL CHRONOLOGY. Restates what the client recorded, in date order. For attorney review. Not verified, not a finding, and not a declaration.",
    "",
  ];
  rows.forEach((r, i) => {
    lines.push(...renderChronologyRow(r, i + 1), "");
  });
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Input hygiene for saved drafts
// ---------------------------------------------------------------------------

export const MAX_PARAGRAPH = 20_000;
const KEY = /^(incident|evidence|request):[\w-]{1,64}$/;

const asKeys = (v: unknown): string[] =>
  Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === "string" && KEY.test(x)))) : [];

/**
 * Shape what the browser sends into a DeclarationContent. It does not decide what
 * the attorney has reviewed (the server stamps that) and it only accepts item keys,
 * never item content.
 */
export function sanitizeDeclaration(
  raw: unknown,
): Omit<DeclarationContent, "reviewed" | "packageVersion"> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const included = asKeys(r.included);
  const inc = new Set(included);
  const declined = asKeys(r.declined).filter((k) => !inc.has(k));
  const overridesIn = (r.overrides && typeof r.overrides === "object" ? r.overrides : {}) as Record<string, unknown>;
  const overrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(overridesIn)) {
    if (inc.has(k) && typeof v === "string" && v.trim()) overrides[k] = v.slice(0, MAX_PARAGRAPH);
  }
  const added: DeclarationContent["added"] = [];
  if (Array.isArray(r.added)) {
    for (const a of r.added.slice(0, 200)) {
      const o = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_PARAGRAPH) : "";
      if (!text) continue;
      const afterKey = typeof o.afterKey === "string" && inc.has(o.afterKey) ? o.afterKey : null;
      const id = typeof o.id === "string" && /^[\w-]{1,64}$/.test(o.id) ? o.id : `p${added.length + 1}`;
      added.push({ id, text, afterKey });
    }
  }
  return {
    title: (typeof r.title === "string" && r.title.trim() ? r.title.trim() : EMPTY_DECLARATION.title).slice(0, 200),
    declarantName: typeof r.declarantName === "string" && r.declarantName.trim() ? r.declarantName.trim().slice(0, 200) : null,
    included,
    declined,
    overrides,
    added,
  };
}
