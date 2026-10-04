import { describe, expect, it } from "vitest";
import {
  DRAFT_BANNER,
  EMPTY_DECLARATION,
  analyzeDraft,
  buildChronology,
  buildDraftParagraphs,
  describeDate,
  formatDay,
  generatedParagraph,
  itemRefs,
  renderChronologyText,
  renderDeclarationText,
  sanitizeDeclaration,
  type DeclarationContent,
} from "@/lib/chronology";
import { planNextPackage, type ExhibitPackage } from "@/lib/exhibit-numbering";

const inc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Entry ${id}`,
  date: "2026-03-03",
  date_precision: "exact",
  description: `Text of ${id}`,
  created_at: "2026-03-04T10:00:00Z",
  ...over,
});
const ev = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `File ${id}`,
  date: "2026-03-05",
  date_precision: "exact",
  description: `About ${id}`,
  created_at: "2026-03-06T10:00:00Z",
  ...over,
});

function pkgFor(incidents: object[], evidence: object[] = []): ExhibitPackage {
  const v1 = planNextPackage(itemRefs(incidents as never, evidence as never, []), null);
  return { version: v1.version, entries: v1.entries };
}

describe("dates keep the uncertainty they were recorded with", () => {
  it("exact date reads as a plain date", () => {
    expect(describeDate(inc("a"))).toMatchObject({ text: "March 3, 2026", certainty: "exact", sortDate: "2026-03-03" });
    expect(formatDay("2026-03-03")).toBe("March 3, 2026");
  });

  it("approximate month never gains a day", () => {
    const d = describeDate(inc("a", { date: "2026-03-01", date_precision: "approximate_month" }));
    expect(d.text).toBe("March 2026 (approximate; exact day not known)");
    expect(d.lead).toBe("In or around March 2026");
    expect(d.certainty).toBe("approximate");
  });

  it("a range stays a range, and a one-ended range says the other end is unknown", () => {
    const r = describeDate(
      inc("a", { date_precision: "range", date_range_start: "2026-03-03", date_range_end: "2026-03-09" }),
    );
    expect(r.text).toBe("Between March 3, 2026 and March 9, 2026 (exact day not known)");
    expect(r.sortDate).toBe("2026-03-03");
    const half = describeDate(inc("a", { date_precision: "range", date_range_start: "2026-03-03", date_range_end: null }));
    expect(half.text).toBe("On or after March 3, 2026 (other end not known)");
  });

  it("a date given relative to another event has no calendar position", () => {
    const d = describeDate(inc("a", { date_precision: "before_anchor", anchor_label: "the hearing" }));
    expect(d.text).toBe("Before the hearing (no calendar date given)");
    expect(d.sortDate).toBeNull();
    expect(d.certainty).toBe("relative");
  });

  it("missing or impossible dates read as not known, never as a made-up date", () => {
    expect(describeDate(inc("a", { date: null })).text).toBe("Date not known");
    expect(describeDate(inc("a", { date: "2026-13-40" })).text).toBe("Date not known");
    expect(describeDate(inc("a", { date_precision: "unknown" })).certainty).toBe("unknown");
  });

  it("an upload date is never shown as the event date", () => {
    const rows = buildChronology([], [ev("f", { date: null })], [], null);
    expect(rows[0]!.date.certainty).toBe("unknown");
    expect(rows[0]!.date.text).toBe("Date not known");
    expect(rows[0]!.enteredOn).toBe("2026-03-06");
    expect(rows[0]!.flags.join(" ")).toMatch(/upload date .* is not the date of the event/);
  });

  it("a date taken from file metadata is flagged as unconfirmed", () => {
    const rows = buildChronology([], [ev("f", { date: null, event_at: "2026-02-10T08:00:00Z" })], [], null);
    expect(rows[0]!.date.text).toBe("February 10, 2026");
    expect(rows[0]!.flags.join(" ")).toMatch(/metadata, which the client has not confirmed/);
  });
});

describe("ordering", () => {
  it("dated rows in date order, rows without a calendar position last, ties keep input order", () => {
    const rows = buildChronology(
      [
        inc("rel", { date_precision: "after_anchor", anchor_label: "the move" }),
        inc("late", { date: "2026-05-01" }),
        inc("tie1", { date: "2026-03-03" }),
        inc("early", { date: "2026-01-01" }),
        inc("tie2", { date: "2026-03-03" }),
        inc("none", { date: null }),
      ],
      [],
      [],
      null,
    );
    expect(rows.map((r) => r.id)).toEqual(["early", "tie1", "tie2", "late", "rel", "none"]);
  });
});

describe("the client's words are quoted completely and exactly", () => {
  it("never truncates a long record or adds an ellipsis", () => {
    const long = "word ".repeat(2000).trim(); // ~10,000 chars
    const [row] = buildChronology([inc("a", { description: long })], [], [], null);
    const text = generatedParagraph(row!);
    expect(text).toContain(`“${long}”`);
    expect(text).not.toContain("…");
    expect(text).not.toContain("...");
  });

  it("keeps the client's own quotation marks and line breaks untouched", () => {
    const words = 'He said "you will regret this"\nthen left';
    const [row] = buildChronology([inc("a", { description: words })], [], [], null);
    expect(row!.quote).toBe(words);
    expect(generatedParagraph(row!)).toContain(words);
  });

  it("attributes location and witnesses as entered, in quotes", () => {
    const [row] = buildChronology([inc("a", { location: "Parking lot", witnesses: "Her neighbor" })], [], [], null);
    const t = generatedParagraph(row!);
    expect(t).toContain("The entry gives the location as: “Parking lot”.");
    expect(t).toContain("The entry lists these witnesses: “Her neighbor”.");
  });

  it("an entry with no text says so rather than inventing any", () => {
    const [row] = buildChronology([inc("a", { description: null })], [], [], null);
    expect(generatedParagraph(row!)).toContain("The entry has no description text.");
  });

  it("time is shown as entered, with the time-zone gap stated", () => {
    const [row] = buildChronology([inc("a", { time: "21:05" })], [], [], null);
    expect(generatedParagraph(row!)).toContain("at about 9:05 PM (time as entered; time zone not recorded)");
  });
});

describe("text PatternProof writes never characterizes or concludes", () => {
  const FORBIDDEN = [
    "abus",
    "threat",
    "harass",
    "stalk",
    "assault",
    "violen",
    "intimidat",
    "coerc",
    "control",
    "victim",
    "perpetrator",
    "guilty",
    "proves",
    "clearly",
    "obviously",
    "sworn to",
    "under penalty of perjury",
    "I declare",
  ];
  const stripQuotes = (s: string) => s.replace(/“[^”]*”/g, "");

  it("static wording has none of those words, whatever the client wrote", () => {
    const rows = buildChronology(
      [
        inc("a", {
          description: "He threatened me and was violent and controlling and stalking",
          witnesses: "victim advocate",
          location: "abuse shelter",
        }),
      ],
      [ev("f", { description: "proof of harassment", title: "Assault photo" })],
      [],
      null,
    );
    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: rows.map((r) => r.key),
    };
    const written = [
      ...buildDraftParagraphs(draft, rows).map((p) => stripQuotes(p.text)),
      stripQuotes(renderChronologyText(rows)),
    ]
      .join(" ")
      .toLowerCase();
    for (const w of FORBIDDEN) expect(written).not.toContain(w.toLowerCase());
    // Disclaimers like "not verified" are fine; a positive claim is not.
    const claims = written.replace(/not verified/g, "").replace(/not been checked/g, "");
    expect(claims).not.toMatch(/verified|authentic|admissible|certified|court-/);
    // ...while the client's own words are still there, unchanged.
    expect(buildDraftParagraphs(draft, rows)[0]!.text).toContain("He threatened me and was violent");
  });

  it("the draft banner calls it unsigned and unsworn and claims nothing else", () => {
    const text = renderDeclarationText(EMPTY_DECLARATION, [], null);
    expect(text.startsWith("UNSIGNED, UNSWORN DRAFT")).toBe(true);
    expect(DRAFT_BANNER.join(" ")).toMatch(/personal knowledge is for the attorney and the declarant/);
    expect(text).toMatch(/Signature block .* Added by the attorney\. Not generated\./);
    expect(text.toLowerCase()).not.toContain("under penalty of perjury");
  });
});

describe("attribution and basis", () => {
  it("entries, files and answers are labelled for what they are", () => {
    const rows = buildChronology(
      [inc("a")],
      [ev("f")],
      [{ id: "r", status: "submitted", title: "Lease", submitted_at: "2026-03-07T00:00:00Z", response_note: "Attached" }],
      null,
    );
    const basis = Object.fromEntries(rows.map((r) => [r.kind, r.basis]));
    expect(basis).toEqual({ incident: "client_entry", evidence: "client_file", request: "client_answer" });
  });

  it("machine-read text is kept apart from the client's words and flagged until checked", () => {
    const [unchecked] = buildChronology([], [ev("f", { extracted_text: "OCR words" })], [], null);
    expect(unchecked!.machineText).toEqual({ kind: "extracted_text", text: "OCR words", checked: false });
    expect(unchecked!.quote).toBe("About f");
    expect(unchecked!.flags.join(" ")).toMatch(/read by software and has not been checked/);
    const [checked] = buildChronology(
      [],
      [ev("f", { extracted_text: "OCR words", extraction_verified_at: "2026-03-08T00:00:00Z" })],
      [],
      null,
    );
    expect(checked!.machineText!.checked).toBe(true);
    expect(checked!.flags.join(" ")).not.toMatch(/read by software/);
  });

  it("an entry drafted by software is labelled, with the confirmation date", () => {
    const [row] = buildChronology([inc("a", { source: "ai_extracted", confirmed_at: "2026-03-09T00:00:00Z" })], [], [], null);
    expect(row!.flags.join(" ")).toMatch(/Drafted by software .* confirmed by the client on March 9, 2026/);
  });

  it("lists linked files only when they are shared too", () => {
    const rows = buildChronology([inc("a")], [ev("f", { linked_incident_id: "a" }), ev("g", { linked_incident_id: "a" })], [], null);
    const a = rows.find((r) => r.key === "incident:a")!;
    expect(a.relatedKeys.sort()).toEqual(["evidence:f", "evidence:g"]);
    const noFiles = buildChronology([inc("a")], [], [], null);
    expect(noFiles[0]!.relatedKeys).toEqual([]);
  });
});

describe("exhibit references", () => {
  it("cites the frozen package numbers, which do not move when items are added", () => {
    const pkg = pkgFor([inc("a", { date: "2026-02-01" }), inc("b", { date: "2026-03-01" })]);
    const rows = buildChronology(
      [inc("a", { date: "2026-02-01" }), inc("b", { date: "2026-03-01" }), inc("z", { date: "2026-01-01" })],
      [],
      [],
      pkg,
    );
    const label = (id: string) => rows.find((r) => r.id === id)!.exhibit.label;
    expect(label("a")).toBe("Exhibit 1");
    expect(label("b")).toBe("Exhibit 2");
    expect(label("z")).toBe("Not yet numbered");
  });

  it("says when a number is provisional, in the paragraph and the export", () => {
    const rows = buildChronology([inc("a")], [], [], null);
    expect(generatedParagraph(rows[0]!)).toContain("See Provisional 1 (provisional number).");
    const text = renderDeclarationText({ ...EMPTY_DECLARATION, included: ["incident:a"] }, rows, null);
    expect(text).toMatch(/Exhibit numbers in this draft are PROVISIONAL/);
  });
});

describe("a draft never changes by itself", () => {
  const a = inc("a", { date: "2026-02-01" });
  const b = inc("b", { date: "2026-03-01" });

  it("a newly shared item is offered, not added", () => {
    const rowsNow = buildChronology([a, b], [], [], null);
    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: ["incident:a"],
      reviewed: { "incident:a": rowsNow.find((r) => r.id === "a")!.marker },
    };
    const analysis = analyzeDraft(draft, rowsNow, null);
    expect(analysis.needsDecision).toEqual(["incident:b"]);
    const paragraphs = buildDraftParagraphs(draft, rowsNow);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]!.text).not.toContain("Text of b");
  });

  it("an item the attorney declined does not come back as new", () => {
    const rowsNow = buildChronology([a, b], [], [], null);
    const draft: DeclarationContent = { ...EMPTY_DECLARATION, included: ["incident:a"], declined: ["incident:b"] };
    expect(analyzeDraft(draft, rowsNow, null).needsDecision).toEqual([]);
  });

  it("attorney edits are kept, and flagged when the source changes under them", () => {
    const before = buildChronology([a], [], [], null);
    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: ["incident:a"],
      overrides: { "incident:a": "Attorney's rewording." },
      reviewed: { "incident:a": before[0]!.marker },
    };
    expect(buildDraftParagraphs(draft, before)[0]).toMatchObject({ origin: "edited", text: "Attorney's rewording.", flags: [] });

    const after = buildChronology([{ ...a, description: "The client later changed this." }], [], [], null);
    const p = buildDraftParagraphs(draft, after)[0]!;
    expect(p.text).toBe("Attorney's rewording."); // not overwritten
    expect(p.flags.join(" ")).toMatch(/source changed after you reviewed it/i);
    expect(analyzeDraft(draft, after, null).changedSinceReview).toEqual(["incident:a"]);
  });

  it("an unedited paragraph is regenerated from the changed source and flagged", () => {
    const before = buildChronology([a], [], [], null);
    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: ["incident:a"],
      reviewed: { "incident:a": before[0]!.marker },
    };
    const after = buildChronology([{ ...a, description: "New wording by the client." }], [], [], null);
    const p = buildDraftParagraphs(draft, after)[0]!;
    expect(p.text).toContain("New wording by the client.");
    expect(p.flags.join(" ")).toMatch(/regenerated from the current record/);
  });

  it("text from an item that is no longer shared is hidden, even attorney-edited text", () => {
    const before = buildChronology([a], [], [], null);
    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: ["incident:a"],
      overrides: { "incident:a": "Edited text that quotes the survivor." },
      reviewed: { "incident:a": before[0]!.marker },
    };
    const gone = buildChronology([], [], [], null);
    const [p] = buildDraftParagraphs(draft, gone);
    expect(p!.text).toMatch(/no longer shared with you\. Its text is hidden/);
    expect(p!.text).not.toContain("Edited text");
    expect(analyzeDraft(draft, gone, null).withdrawn).toEqual(["incident:a"]);
    expect(renderDeclarationText(draft, gone, null)).not.toContain("Edited text");
  });

  it("flags provisional exhibit numbers and a package that has moved on", () => {
    const rows = buildChronology([a], [], [], null);
    const draft: DeclarationContent = { ...EMPTY_DECLARATION, included: ["incident:a"], reviewed: {} };
    expect(analyzeDraft(draft, rows, null).uncitedExhibits).toEqual(["incident:a"]);

    const pkg = pkgFor([a]);
    const rows2 = buildChronology([a], [], [], pkg);
    const behind = analyzeDraft({ ...draft, packageVersion: null }, rows2, { ...pkg, version: 2 });
    expect(behind.packageBehind).toBe(true);
    expect(analyzeDraft({ ...draft, packageVersion: 2 }, rows2, { ...pkg, version: 2 }).packageBehind).toBe(false);
  });

  it("attorney-written paragraphs are placed where asked and marked as the attorney's", () => {
    const rows = buildChronology([a, b], [], [], null);
    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: ["incident:a", "incident:b"],
      added: [{ id: "x", text: "Attorney paragraph.", afterKey: "incident:a" }],
    };
    const ps = buildDraftParagraphs(draft, rows);
    expect(ps.map((p) => p.origin)).toEqual(["generated", "attorney_added", "generated"]);
    expect(ps.map((p) => p.n)).toEqual([1, 2, 3]);
    expect(ps[1]!.basis).toBe("Written by the attorney");
    expect(ps[1]!.addedId).toBe("x");
  });
});

describe("change markers follow what a reader would see", () => {
  it("same content gives the same marker; any visible edit changes it", () => {
    const m = (o: Record<string, unknown>) => buildChronology([inc("a", o)], [], [], null)[0]!.marker;
    expect(m({})).toBe(m({}));
    expect(m({})).not.toBe(m({ description: "different" }));
    expect(m({})).not.toBe(m({ date: "2026-03-04" }));
    expect(m({})).not.toBe(m({ witnesses: "someone" }));
  });
});

describe("saved-draft input hygiene", () => {
  it("accepts only item keys, never content, and keeps included and declined apart", () => {
    const c = sanitizeDeclaration({
      included: ["incident:a", "incident:a", "evidence:f", "not a key", 5],
      declined: ["incident:a", "request:r"],
    });
    expect(c.included).toEqual(["incident:a", "evidence:f"]);
    expect(c.declined).toEqual(["request:r"]);
  });

  it("keeps edits only for included items and limits their length", () => {
    const c = sanitizeDeclaration({
      included: ["incident:a"],
      overrides: { "incident:a": "x".repeat(30000), "incident:zzz": "stray", "incident:b": "not included" },
    });
    expect(Object.keys(c.overrides)).toEqual(["incident:a"]);
    expect(c.overrides["incident:a"]!.length).toBe(20000);
  });

  it("attorney paragraphs need text and can only follow an included item", () => {
    const c = sanitizeDeclaration({
      included: ["incident:a"],
      added: [
        { id: "p1", text: "  Kept.  ", afterKey: "incident:a" },
        { id: "p2", text: "   ", afterKey: null },
        { id: "bad id!", text: "Elsewhere", afterKey: "incident:nope" },
      ],
    });
    expect(c.added.map((a) => [a.text, a.afterKey])).toEqual([
      ["Kept.", "incident:a"],
      ["Elsewhere", null],
    ]);
  });

  it("garbage in gives an empty, valid draft", () => {
    const c = sanitizeDeclaration("nope");
    expect(c).toMatchObject({ included: [], declined: [], overrides: {}, added: [], declarantName: null });
    expect(c.title).toBe("Draft factual declaration");
  });
});
