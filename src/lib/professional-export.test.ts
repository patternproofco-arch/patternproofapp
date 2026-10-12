import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
  loadProfessionalExportRecords,
  readExportRows,
  readExportIds,
  safeProfessionalStoragePath,
  incidentEligible,
  evidenceEligible,
  professionalEvidenceFilename,
} from "./professional-export.server";

const state = vi.hoisted(() => ({
  admin: null as any,
  link: null as any,
  entitled: true,
  revoked: false,
  mutateOnDownload: null as null | (() => void),
  accessCalls: 0,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: any) => fn,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/lib/subscription-state", () => ({
  pickPaidSubscription: () => null,
}));
vi.mock("@/lib/return-url", () => ({ assertSafeReturnUrl: (v: string) => v }));
vi.mock("@/lib/stripe.server", () => ({
  createStripeClient: () => ({}),
  getStripeErrorMessage: () => "error",
}));
vi.mock("@/lib/professional-links.server", () => ({
  PROFESSIONAL_LINK_TTL_SECONDS: 60,
}));
vi.mock("@/lib/attorney-access.server", () => ({
  isExpired: (value: string | null) =>
    value ? Date.parse(value) <= Date.now() : false,
  LINK_COLUMNS: "id",
  assertCaseAccess: async () => {
    const link = structuredClone(state.link);
    if (state.revoked) throw new Error("No active access");
    if (link.case_id) {
      const c = state.admin.tables.cases.find(
        (row: Row) => row.id === link.case_id,
      );
      link.scope_incidents = link.scope_incidents.filter((id: string) =>
        c.highlighted_incident_ids.includes(id),
      );
      link.scope_evidence = link.scope_evidence.filter((id: string) =>
        c.attached_evidence_ids.includes(id),
      );
    }
    return { link, role: "owner" };
  },
  patternsVisibleToProfessional: async () => false,
  assertLink: async () => {
    state.accessCalls++;
    if (
      state.revoked ||
      state.link.status !== "active" ||
      state.link.revoked_at ||
      (state.link.expires_at && Date.parse(state.link.expires_at) <= Date.now())
    )
      throw new Error("No active access");
    // Simulate the existing access helper's legacy snapshot normalization, not blanket queries.
    const link = structuredClone(state.link);
    if (link.include_all_incidents) {
      link.include_all_incidents = false;
      link.scope_incidents = link.snapshot_incidents;
    }
    if (link.include_all_evidence) {
      link.include_all_evidence = false;
      link.scope_evidence = link.snapshot_evidence;
    }
    return link;
  },
}));
vi.mock("@/lib/pattern-export", () => ({ buildPatternExport: () => null }));
import {
  generateAttorneyCourtPacket,
  generateCaseManagementPackage,
} from "./payments.functions";
import { getClientCase } from "./attorney-portal.functions";

const CLIENT = "f2adb8b7-5a9f-42fd-974e-7dfc186fb17b";
const ATTORNEY = "00000000-0000-4000-8000-000000000001";
type Row = Record<string, any>;
class Query {
  predicates: Array<(row: Row) => boolean> = [];
  columns = "*";
  start = 0;
  end = Infinity;
  constructor(
    public db: MockAdmin,
    public table: string,
  ) {}
  select(columns: string) {
    this.columns = columns;
    return this;
  }
  eq(key: string, value: any) {
    this.predicates.push((row) => row[key] === value);
    return this;
  }
  in(key: string, values: any[]) {
    this.db.chunks.push({ table: this.table, key, size: values.length });
    this.predicates.push((row) => values.includes(row[key]));
    return this;
  }
  is(key: string, value: any) {
    this.predicates.push((row) =>
      value === null ? row[key] == null : row[key] === value,
    );
    return this;
  }
  // Deliberately don't implement OR: defensive eligibility must still protect
  // the archive even when a mock/adapter returns rows beyond SQL predicates.
  or(value: string) {
    this.db.ors.push(value);
    return this;
  }
  order(key: string) {
    this.db.orders.push({ table: this.table, key });
    return this;
  }
  limit(count: number) {
    this.end = count - 1;
    return this;
  }
  range(start: number, end: number) {
    this.start = start;
    this.end = end;
    return this;
  }
  result(single = false) {
    this.db.reads.push({ table: this.table, start: this.start });
    if (this.db.failTable === this.table && this.start >= this.db.failStart)
      return { data: null, error: { message: "injected" } };
    const rows = (this.db.tables[this.table] ?? [])
      .filter((row) => this.predicates.every((fn) => fn(row)))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(this.start, this.end + 1)
      .map((row) =>
        this.columns === "*"
          ? { ...row }
          : Object.fromEntries(
              this.columns
                .split(",")
                .map((key) => [key.trim(), row[key.trim()]]),
            ),
      );
    return { data: single ? (rows[0] ?? null) : rows, error: null };
  }
  maybeSingle() {
    return Promise.resolve(this.result(true));
  }
  then(resolve: any, reject: any) {
    return Promise.resolve(this.result()).then(resolve, reject);
  }
}
class MockAdmin {
  tables: Record<string, Row[]> = {};
  reads: Array<{ table: string; start: number }> = [];
  chunks: Array<{ table: string; key: string; size: number }> = [];
  orders: Array<{ table: string; key: string }> = [];
  ors: string[] = [];
  failTable = "";
  failStart = 0;
  missingBlob = false;
  blobError = false;
  uploads: Uint8Array[] = [];
  downloads: string[] = [];
  from(table: string) {
    return new Query(this, table);
  }
  rpc(name: string) {
    return Promise.resolve({
      data:
        name === "attorney_billing_state" ? [{ entitled: state.entitled }] : [],
      error: null,
    });
  }
  storage = {
    from: (bucket: string) => ({
      download: async (path: string) => {
        expect(bucket).toBe("evidence-files");
        this.downloads.push(path);
        state.mutateOnDownload?.();
        return {
          data: this.missingBlob ? null : new Blob(["actual evidence bytes"]),
          error: this.blobError ? { message: "storage failure" } : null,
        };
      },
      upload: async (_path: string, bytes: Uint8Array) => {
        this.uploads.push(bytes);
        return { error: null };
      },
      createSignedUrl: async () => ({
        data: { signedUrl: "https://example.test/authorized" },
        error: null,
      }),
    }),
  };
}

function fixture() {
  const db = new MockAdmin();
  const incidents = Array.from({ length: 9 }, (_, n) => ({
    id: `good-${n}`,
    user_id: CLIENT,
    date: "2026-03-12",
    description: `eligible-description-${n}`,
    source: n === 0 ? null : "manual",
    is_draft: n === 0 ? null : false,
    confirmed_at: null,
    deleted_at: null,
  }));
  const excluded = [
    {
      id: "airtag",
      source: "ai_extracted",
      description: "EXCLUDED-AIRTAG",
      confirmed_at: null,
      is_draft: false,
    },
    {
      id: "facebook",
      source: "ai_extracted",
      description: "EXCLUDED-FACEBOOK",
      confirmed_at: null,
      is_draft: false,
    },
    {
      id: "manual-draft",
      source: "manual",
      description: "EXCLUDED-MANUAL-DRAFT",
      is_draft: true,
    },
    {
      id: "deleted",
      source: "manual",
      description: "EXCLUDED-DELETED",
      deleted_at: "2026-01-01",
    },
    { id: "private", source: "manual", description: "EXCLUDED-PRIVATE" },
    {
      id: "other-owner",
      source: "manual",
      description: "EXCLUDED-OWNER",
      user_id: "stranger",
    },
    { id: "other-case", source: "manual", description: "EXCLUDED-OTHER-CASE" },
  ].map((row) => ({
    user_id: CLIENT,
    date: "2026-01-10",
    deleted_at: null,
    ...row,
  }));
  db.tables.incidents = [...incidents, ...excluded];
  db.tables.incidents[0].anchor_incident_id = "EXCLUDED-ANCHOR-ID";
  db.tables.incidents[0].source_evidence_id = "EXCLUDED-SOURCE-EVIDENCE-ID";
  db.tables.incidents[0].ai_permission = "HIDDEN-INCIDENT-AI";
  db.tables.incidents[0].template_key = "HIDDEN-INCIDENT-TEMPLATE";
  db.tables.evidence = [
    {
      id: "evidence-good",
      user_id: CLIENT,
      title: "Good file",
      date: null,
      file_url: `${CLIENT}/good.txt`,
      linked_incident_id: "airtag",
      suggested_incident_id: "facebook",
      parent_evidence_id: "EXCLUDED-PARENT-ID",
      near_duplicate_of: "EXCLUDED-DUPLICATE-ID",
      linked_recording_id: "EXCLUDED-RECORDING-ID",
      gps_lat: 1,
      gps_lon: 2,
      gps_reveal_opt_in: false,
      raw_metadata: { gps: "HIDDEN-GPS-METADATA" },
      perceptual_hash: "HIDDEN-PERCEPTUAL-HASH",
      ai_permission: "HIDDEN-EVIDENCE-AI",
      share_readiness: "HIDDEN-READINESS",
      transcript_verified_by: "HIDDEN-VERIFIER",
      review_status: null,
    },
    {
      id: "evidence-suggested",
      user_id: CLIENT,
      title: "EXCLUDED-SUGGESTED",
      review_status: "suggested",
      file_url: "stranger/file",
    },
    {
      id: "evidence-private",
      user_id: CLIENT,
      title: "EXCLUDED-PRIVATE-FILE",
      file_url: `${CLIENT}/private.txt`,
    },
  ];
  state.link = {
    id: "link",
    status: "active",
    case_id: "case",
    include_all_incidents: false,
    include_all_evidence: false,
    include_communications: true,
    include_patterns: true,
    scope_incidents: [
      ...incidents.map((i) => i.id),
      ...excluded.filter((i) => i.id !== "private").map((i) => i.id),
    ],
    scope_evidence: ["evidence-good", "evidence-suggested"],
  };
  db.tables.cases = [
    {
      id: "case",
      user_id: CLIENT,
      case_type: "Authorized case",
      other_party: "Authorized party",
      jurisdiction: "Test",
      highlighted_incident_ids: db.tables.incidents
        .filter((i) => i.id !== "other-case")
        .map((i) => i.id),
      attached_evidence_ids: ["evidence-good", "evidence-suggested"],
      pattern_summary: "EXCLUDED-PRIVATE-CASE-NARRATIVE",
    },
    {
      id: "other-case-record",
      user_id: CLIENT,
      case_type: "EXCLUDED-CASE-TYPE",
      pattern_summary: "EXCLUDED-OTHER-CASE-NARRATIVE",
    },
  ];
  db.tables.communications = [
    {
      id: "comm-good",
      user_id: CLIENT,
      linked_incident_id: "good-0",
      content: "Allowed communication",
    },
    {
      id: "comm-bad",
      user_id: CLIENT,
      linked_incident_id: "airtag",
      content: "EXCLUDED-COMM",
    },
  ];
  db.tables.escalation_flags = [
    {
      id: "flag-good",
      user_id: CLIENT,
      incident_id: "good-0",
      summary: "Allowed flag",
    },
    {
      id: "flag-bad",
      user_id: CLIENT,
      incident_id: "airtag",
      summary: "EXCLUDED-FLAG",
    },
  ];
  db.tables.attorney_evidence_reviews = [
    {
      id: "review-good",
      attorney_user_id: ATTORNEY,
      client_user_id: CLIENT,
      evidence_id: "evidence-good",
      linked_incident_id: "airtag",
      status: "exhibit_candidate",
      notes: "Allowed review",
    },
    {
      id: "review-bad",
      attorney_user_id: ATTORNEY,
      client_user_id: CLIENT,
      evidence_id: "evidence-private",
      notes: "EXCLUDED-REVIEW",
    },
  ];
  db.tables.attorney_document_requests = [
    {
      id: "request-good",
      attorney_user_id: ATTORNEY,
      client_user_id: CLIENT,
      link_id: "link",
      title: "Allowed request",
    },
    {
      id: "request-bad",
      attorney_user_id: ATTORNEY,
      client_user_id: CLIENT,
      link_id: "other-link",
      title: "EXCLUDED-REQUEST",
    },
  ];
  db.tables.attorney_client_links = [
    {
      id: "link",
      status: "active",
      revoked_at: null,
      attorney_user_id: ATTORNEY,
      client_user_id: CLIENT,
      attorney_case_notes: "Allowed case note",
    },
  ];
  db.tables.attorney_incident_notes = [
    {
      id: "note-good",
      link_id: "link",
      attorney_user_id: ATTORNEY,
      client_user_id: CLIENT,
      incident_id: "good-0",
      note: "Allowed note",
    },
    {
      id: "note-bad",
      link_id: "link",
      attorney_user_id: ATTORNEY,
      client_user_id: CLIENT,
      incident_id: "airtag",
      note: "EXCLUDED-NOTE",
    },
  ];
  state.admin = db;
  return db;
}
beforeEach(() => {
  state.entitled = true;
  state.revoked = false;
  state.accessCalls = 0;
  state.mutateOnDownload = null;
  fixture();
});
const handlers = [
  ["review ZIP", generateAttorneyCourtPacket, "incidents.csv", "evidence"],
  ["import ZIP", generateCaseManagementPackage, "events.csv", "documents"],
] as const;
async function run(handler: any, includeNotes = true) {
  return handler({
    data: { clientId: CLIENT, includeAttorneyNotes: includeNotes },
    context: { userId: ATTORNEY },
  });
}

describe("professional ZIP handlers (real ZIP members, mocked server/database/storage boundary)", () => {
  for (const [name, handler, incidentMember, fileFolder] of handlers) {
    it(`${name}: exactly nine eligible entries, no excluded content anywhere, matched stored blobs`, async () => {
      const result = await run(handler);
      expect(result.ok).toBe(true);
      const db = state.admin as MockAdmin;
      expect(db.uploads).toHaveLength(1);
      expect(state.accessCalls).toBe(2);
      const zip = await JSZip.loadAsync(db.uploads[0]);
      const manifest = JSON.parse(
        await zip.file("manifest.json")!.async("string"),
      );
      expect(manifest.counts.incidents).toBe(9);
      expect(manifest.counts.evidence).toBe(1);
      expect(manifest.file_hashes).toHaveLength(1);
      expect(manifest.file_hashes[0].path).toMatch(
        new RegExp(`^${fileFolder}/`),
      );
      expect(
        await zip.file(manifest.file_hashes[0].path)!.async("string"),
      ).toBe("actual evidence bytes");
      const incidentCsv = await zip.file(incidentMember)!.async("string");
      expect(incidentCsv.match(/eligible-description-/g) ?? []).toHaveLength(9);
      for (const member of Object.values(zip.files).filter((f) => !f.dir)) {
        const text = await member.async("string");
        expect(text, member.name).not.toContain("EXCLUDED-");
        expect(text, member.name).not.toContain("airtag");
        expect(text, member.name).not.toContain("facebook");
        expect(text, member.name).not.toContain("gps_lat");
        expect(text, member.name).not.toContain("HIDDEN-");
        expect(text, member.name).not.toContain("raw_metadata");
        expect(text, member.name).not.toContain("perceptual_hash");
      }
      expect(zip.file("pattern_analysis.json")).toBeNull();
      if (name === "review ZIP") {
        expect(await zip.file("case.json")!.async("string")).not.toContain(
          "highlighted_incident_ids",
        );
        expect(
          await zip.file("07_attorney_notes.md")!.async("string"),
        ).toContain("Allowed note");
      }
      expect(db.downloads).toEqual([`${CLIENT}/good.txt`]);
      expect(Math.max(...db.chunks.map((c) => c.size))).toBeLessThanOrEqual(
        100,
      );
    });
    it(`${name}: accepts AI only after confirmation, excludes again after withdrawal`, async () => {
      const db = state.admin as MockAdmin;
      db.tables.incidents.find((i) => i.id === "airtag")!.confirmed_at =
        "2026-10-11T00:00:00Z";
      expect((await run(handler)).ok).toBe(true);
      let zip = await JSZip.loadAsync(db.uploads[0]);
      expect(
        JSON.parse(await zip.file("manifest.json")!.async("string")).counts
          .incidents,
      ).toBe(10);
      db.tables.incidents.find((i) => i.id === "airtag")!.confirmed_at = null;
      await run(handler);
      zip = await JSZip.loadAsync(db.uploads[1]);
      expect(
        JSON.parse(await zip.file("manifest.json")!.async("string")).counts
          .incidents,
      ).toBe(9);
    });
    it(`${name}: archive contains every one of >1000 selected eligible incidents`, async () => {
      state.link.case_id = null;
      state.link.scope_evidence = [];
      state.admin.tables.incidents = Array.from({ length: 1201 }, (_, n) => ({
        id: `bulk-${String(n).padStart(5, "0")}`,
        user_id: CLIENT,
        description: `bulk-description-${n}`,
        date: "2026-03-12",
      }));
      state.link.scope_incidents = state.admin.tables.incidents.map(
        (r: Row) => r.id,
      );
      await run(handler);
      const zip = await JSZip.loadAsync(state.admin.uploads[0]);
      expect(
        JSON.parse(await zip.file("manifest.json")!.async("string")).counts
          .incidents,
      ).toBe(1201);
      expect(
        (await zip.file(incidentMember)!.async("string")).match(
          /bulk-description-/g,
        ),
      ).toHaveLength(1201);
    });
    it(`${name}: all >1000 document requests are emitted after pagination`, async () => {
      state.admin.tables.attorney_document_requests = Array.from(
        { length: 1201 },
        (_, n) => ({
          id: `request-${String(n).padStart(5, "0")}`,
          attorney_user_id: ATTORNEY,
          client_user_id: CLIENT,
          link_id: "link",
          title: `bulk-request-${n}`,
        }),
      );
      await run(handler);
      const zip = await JSZip.loadAsync(state.admin.uploads[0]);
      const member =
        name === "review ZIP" ? "legal/doc_requests.csv" : "tasks.csv";
      expect(
        (await zip.file(member)!.async("string")).match(/bulk-request-/g),
      ).toHaveLength(1201);
    });
    it(`${name}: later enrichment page failure creates no archive`, async () => {
      state.admin.tables.attorney_document_requests = Array.from(
        { length: 1201 },
        (_, n) => ({
          id: `request-${String(n).padStart(5, "0")}`,
          attorney_user_id: ATTORNEY,
          client_user_id: CLIENT,
          link_id: "link",
          title: "request",
        }),
      );
      state.admin.failTable = "attorney_document_requests";
      state.admin.failStart = 500;
      await expect(run(handler)).rejects.toThrow();
      expect(state.admin.uploads).toHaveLength(0);
    });
    it(`${name}: frozen legacy snapshot does not widen to private or later records`, async () => {
      state.link.snapshot_incidents = [...state.link.scope_incidents];
      state.link.snapshot_evidence = [...state.link.scope_evidence];
      state.link.include_all_incidents = state.link.include_all_evidence = true;
      expect((await run(handler)).ok).toBe(true);
      const zip = await JSZip.loadAsync(state.admin.uploads[0]);
      expect(
        JSON.parse(await zip.file("manifest.json")!.async("string")).counts
          .incidents,
      ).toBe(9);
    });
    for (const table of [
      "incidents",
      "evidence",
      "cases",
      "attorney_evidence_reviews",
      "attorney_document_requests",
    ]) {
      it(`${name}: ${table} failure creates no archive`, async () => {
        state.admin.failTable = table;
        await expect(run(handler)).rejects.toThrow();
        expect(state.admin.uploads).toHaveLength(0);
      });
    }
    for (const path of [
      "stranger/file.txt",
      `${CLIENT}/../file.txt`,
      `${CLIENT}/%2e%2e/file.txt`,
      "https://example.test/file.txt",
      null,
    ]) {
      it(`${name}: unsafe path ${String(path)} creates no archive`, async () => {
        state.admin.tables.evidence[0].file_url = path;
        await expect(run(handler)).rejects.toThrow(/storage path/);
        expect(state.admin.downloads).toHaveLength(0);
        expect(state.admin.uploads).toHaveLength(0);
      });
    }
    for (const fault of ["missingBlob", "blobError"]) {
      it(`${name}: ${fault} creates no archive`, async () => {
        state.admin[fault] = true;
        await expect(run(handler)).rejects.toThrow(/could not be downloaded/);
        expect(state.admin.uploads).toHaveLength(0);
      });
    }
    for (const fault of ["revoke", "delete", "unshare", "unconfirm"]) {
      it(`${name}: ${fault} during blob reads prevents publication`, async () => {
        if (fault === "unconfirm") {
          Object.assign(state.admin.tables.incidents[0], {
            source: "ai_extracted",
            confirmed_at: "2026-10-11T00:00:00Z",
          });
        }
        state.mutateOnDownload = () => {
          if (fault === "revoke") state.revoked = true;
          if (fault === "delete")
            state.admin.tables.incidents[0].deleted_at = "2026-10-11";
          if (fault === "unshare") state.link.scope_incidents = [];
          if (fault === "unconfirm")
            state.admin.tables.incidents[0].confirmed_at = null;
        };
        await expect(run(handler)).rejects.toThrow();
        expect(state.admin.uploads).toHaveLength(0);
      });
    }
    for (const denial of ["expired", "revoked", "paywall"]) {
      it(`${name}: ${denial} denies before reads/downloads`, async () => {
        if (denial === "expired") state.link.expires_at = "2020-01-01";
        if (denial === "revoked") state.link.revoked_at = "2026-10-11";
        if (denial === "paywall") state.entitled = false;
        const result = await run(handler);
        expect(result.ok).toBe(false);
        expect(state.admin.reads).toHaveLength(0);
        expect(state.admin.downloads).toHaveLength(0);
        expect(state.admin.uploads).toHaveLength(0);
      });
    }
    it(`${name}: no authorized case means no arbitrary latest-case metadata`, async () => {
      state.link.case_id = null;
      expect((await run(handler)).ok).toBe(true);
      const zip = await JSZip.loadAsync(state.admin.uploads[0]);
      expect(zip.file("case.json")).toBeNull();
      expect(state.admin.reads.some((r: any) => r.table === "cases")).toBe(
        false,
      );
      expect(
        await zip
          .file(name === "review ZIP" ? "00_cover.md" : "matter.csv")!
          .async("string"),
      ).not.toContain("Authorized party");
    });
  }
  for (const table of [
    "communications",
    "escalation_flags",
    "attorney_client_links",
    "attorney_incident_notes",
    "time_entries",
  ]) {
    it(`review ZIP: ${table} failure creates no archive`, async () => {
      state.admin.failTable = table;
      await expect(run(generateAttorneyCourtPacket)).rejects.toThrow();
      expect(state.admin.uploads).toHaveLength(0);
    });
  }
  it("review ZIP: notes off never reads private notes; communications consent off never reads messages", async () => {
    state.link.include_communications = false;
    await run(generateAttorneyCourtPacket, false);
    expect(
      state.admin.reads.filter((r: any) =>
        [
          "communications",
          "attorney_incident_notes",
          "attorney_client_links",
        ].includes(r.table),
      ),
    ).toEqual([]);
    const zip = await JSZip.loadAsync(state.admin.uploads[0]);
    expect(zip.file("07_attorney_notes.md")).toBeNull();
  });
  it("import ZIP: profile read error blocks upload", async () => {
    state.admin.failTable = "attorney_profiles";
    await expect(run(generateCaseManagementPackage)).rejects.toThrow();
    expect(state.admin.uploads).toHaveLength(0);
  });
});

describe("actual shared professional loader", () => {
  it("preserves legacy null manual values and rejects draft/AI/suggested rows", () => {
    expect(incidentEligible({ source: null, is_draft: null })).toBe(true);
    expect(
      incidentEligible({
        source: "ai_extracted",
        is_draft: false,
        confirmed_at: null,
      }),
    ).toBe(false);
    expect(incidentEligible({ source: "manual", is_draft: true })).toBe(false);
    expect(evidenceEligible({ review_status: "suggested" })).toBe(false);
    expect(
      evidenceEligible({ source: "ai_extracted", confirmed_at: null }),
    ).toBe(false);
  });
  it("rejects unresolved blanket authorization", async () => {
    state.link.include_all_incidents = true;
    await expect(
      loadProfessionalExportRecords(state.admin, state.link, CLIENT),
    ).rejects.toThrow(/snapshot/);
  });
  it("requires authorized case to exist and belong to owner", async () => {
    state.admin.tables.cases[0].user_id = "stranger";
    await expect(
      loadProfessionalExportRecords(state.admin, state.link, CLIENT),
    ).rejects.toThrow(/case/);
  });
  it("loads >1000 selected records in 100-id chunks", async () => {
    state.link.case_id = null;
    state.admin.tables.incidents = Array.from({ length: 1201 }, (_, n) => ({
      id: `incident-${String(n).padStart(5, "0")}`,
      user_id: CLIENT,
    }));
    state.link.scope_incidents = state.admin.tables.incidents.map(
      (r: Row) => r.id,
    );
    state.link.scope_evidence = [];
    const records = await loadProfessionalExportRecords(
      state.admin,
      state.link,
      CLIENT,
    );
    expect(records.incidents).toHaveLength(1201);
    expect(
      state.admin.chunks.filter((c: any) => c.table === "incidents"),
    ).toHaveLength(13);
    expect(state.admin.ors).toContain(
      "source.is.null,source.neq.ai_extracted,confirmed_at.not.is.null",
    );
  });
  it("pages >1000 enrichment records and fails on later pages", async () => {
    state.admin.tables.large = Array.from({ length: 1201 }, (_, n) => ({
      id: String(n).padStart(5, "0"),
    }));
    const build = () => state.admin.from("large").select("*");
    expect(await readExportRows(build, "large fixture")).toHaveLength(1201);
    expect(state.admin.reads.map((r: any) => r.start)).toEqual([0, 500, 1000]);
    state.admin.failTable = "large";
    state.admin.failStart = 500;
    await expect(readExportRows(build, "large fixture")).rejects.toThrow(
      /completely read/,
    );
  });
  it("fails on later ID chunk rather than returning partial output", async () => {
    let calls = 0;
    await expect(
      readExportIds(
        Array.from({ length: 201 }, (_, n) => String(n)),
        () => {
          if (++calls === 2) state.admin.failTable = "incidents";
          return state.admin.from("incidents").select("*");
        },
        "fixture",
      ),
    ).rejects.toThrow();
  });
  it("full ids and sanitized date prevent archive collisions/traversal", () => {
    const row = {
      id: "sameprefix-a",
      date: "../../date",
      title: "file",
      file_url: `${CLIENT}/file.txt`,
    };
    expect(professionalEvidenceFilename(row)).not.toContain("/");
    expect(professionalEvidenceFilename(row)).not.toBe(
      professionalEvidenceFilename({ ...row, id: "sameprefix-b" }),
    );
    expect(() =>
      safeProfessionalStoragePath(`${CLIENT}/evil\\file.txt`, CLIENT),
    ).toThrow();
  });
});

describe("actual getClientCase handler regression (mocked access and view projections)", () => {
  it("returns nine eligible incidents, preserving legacy null manual but excluding manual drafts and AI-unconfirmed", async () => {
    const result = await run(getClientCase);
    expect(result.incidents).toHaveLength(9);
    expect(result.incidents.map((row: Row) => row.id)).toContain("good-0");
    expect(result.incidents.some((row: Row) => row.is_draft === true)).toBe(
      false,
    );
    expect(result.incidents.map((row: Row) => row.id)).not.toContain("airtag");
    expect(result.evidence.map((row: Row) => row.id)).toEqual([
      "evidence-good",
    ]);
    expect(result.flags.map((row: Row) => row.id)).toEqual(["flag-good"]);
    expect(result.communications.map((row: Row) => row.id)).toEqual([
      "comm-good",
    ]);
    expect(result.incidents[0].anchor_incident_id).toBeNull();
    const file = result.evidence[0];
    for (const key of [
      "linked_incident_id",
      "suggested_incident_id",
      "parent_evidence_id",
      "near_duplicate_of",
      "linked_recording_id",
    ]) {
      expect(file[key] ?? null, key).toBeNull();
    }
    expect(result.incidents[0].source_evidence_id).toBeNull();
    expect(JSON.stringify(result.communications)).not.toContain(
      "EXCLUDED-COMM",
    );
  });
  for (const table of [
    "incidents",
    "evidence",
    "cases",
    "communications",
    "escalation_flags",
  ]) {
    it(`${table} read failure rejects, not a partial successful case`, async () => {
      state.admin.failTable = table;
      await expect(run(getClientCase)).rejects.toThrow();
    });
  }
  it("blanket branch pages >1000 eligible rows and omits unspecified case metadata", async () => {
    state.link.case_id = null;
    state.link.include_all_incidents = true;
    state.link.include_all_evidence = true;
    state.admin.tables.incidents = Array.from({ length: 1201 }, (_, n) => ({
      id: `bulk-${String(n).padStart(5, "0")}`,
      user_id: CLIENT,
      date: "2026-03-12",
    }));
    const result = await run(getClientCase);
    expect(result.incidents).toHaveLength(1201);
    expect(result.case).toBeNull();
    expect(
      state.admin.reads
        .filter((r: any) => r.table === "incidents")
        .map((r: any) => r.start),
    ).toEqual([0, 1000]);
  });
  it("later blanket page failure rejects instead of reporting first-page-only success", async () => {
    state.link.case_id = null;
    state.link.include_all_incidents = true;
    state.admin.tables.incidents = Array.from({ length: 1201 }, (_, n) => ({
      id: `bulk-${String(n).padStart(5, "0")}`,
      user_id: CLIENT,
    }));
    state.admin.failTable = "incidents";
    state.admin.failStart = 1000;
    await expect(run(getClientCase)).rejects.toThrow();
  });
});

/** Parse actual CSV members, including quoted dates containing commas. */
function csvRecords(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let n = 0; n < text.length; n++) {
    const c = text[n];
    if (c === '"') {
      if (quoted && text[n + 1] === '"') {
        value += '"';
        n++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(value);
      value = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else value += c;
  }
  row.push(value);
  rows.push(row);
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some(Boolean))
    .map((r) => Object.fromEntries(header.map((key, n) => [key, r[n] ?? ""])));
}

describe("actual archive date-certainty and privacy members", () => {
  for (const [name, handler, incidentMember] of handlers) {
    it(`${name}: exact, approximate month, ranges, anchors, unknown and unsupported precision keep meaning`, async () => {
      const db = state.admin as MockAdmin;
      const eligible = db.tables.incidents.filter((i) =>
        String(i.id).startsWith("good-"),
      );
      Object.assign(eligible[0], {
        date: "2025-11-15",
        date_precision: "approximate_month",
      });
      Object.assign(eligible[1], {
        date: "2026-03-12",
        date_precision: "exact",
      });
      Object.assign(eligible[2], {
        date: "2026-01-01",
        date_precision: "range",
        date_range_start: "2026-01-01",
        date_range_end: "2026-02-02",
      });
      Object.assign(eligible[3], {
        date: "2025-08-14",
        date_precision: "before_anchor",
        anchor_label: "moving home",
      });
      Object.assign(eligible[4], {
        date: "2025-08-14",
        date_precision: "after_anchor",
        anchor_label: "moving home",
      });
      Object.assign(eligible[5], {
        date: "2025-07-21",
        date_precision: "unknown",
      });
      Object.assign(eligible[6], {
        date: "2025-07-21",
        date_precision: "unsupported-relative",
      });
      Object.assign(db.tables.evidence[0], {
        date: "2025-11-15",
        date_precision: "approximate_month",
      });
      await run(handler);
      const zip = await JSZip.loadAsync(db.uploads[0]);
      const rows = csvRecords(await zip.file(incidentMember)!.async("string"));
      const idColumn = name === "review ZIP" ? "id" : "source_id";
      const byId = new Map(rows.map((row) => [row[idColumn], row]));
      expect(byId.get("good-0")!.date).toBe("");
      expect(byId.get("good-0")!.sort_date).toBe("2025-11-15");
      expect(byId.get("good-0")!.date_precision).toBe("approximate_month");
      expect(byId.get("good-0")!.date_display).toContain(
        "November 2025 (approximate",
      );
      expect(byId.get("good-1")!.date).toBe("2026-03-12");
      expect(byId.get("good-1")!.date_display).toBe("March 12, 2026");
      expect(byId.get("good-2")!.date_range_end).toBe("2026-02-02");
      expect(byId.get("good-2")!.date_display).toContain(
        "Between January 1, 2026 and February 2, 2026",
      );
      expect(byId.get("good-3")!.date_display).toContain("Before moving home");
      expect(byId.get("good-4")!.date_display).toContain("After moving home");
      for (const id of ["good-2", "good-3", "good-4", "good-5", "good-6"])
        expect(byId.get(id)!.date).toBe("");
      expect(byId.get("good-5")!.date_display).toBe("Date not documented");
      expect(byId.get("good-6")!.date_display).toBe("Date not documented");
      const evidenceMember =
        name === "review ZIP" ? "05_evidence_index.csv" : "documents.csv";
      const ev = csvRecords(await zip.file(evidenceMember)!.async("string"))[0];
      expect(ev.date).toBe("");
      expect(ev.sort_date).toBe("2025-11-15");
      expect(ev.date_display).toContain("November 2025 (approximate");
      if (name === "review ZIP") {
        for (const member of [
          "03_timeline.md",
          "06_exhibit_list.md",
          "07_attorney_notes.md",
        ]) {
          const text = await zip.file(member)!.async("string");
          expect(text).not.toContain("November 15");
          expect(text).not.toContain("2025-11-15");
          expect(text).toContain("November 2025 (approximate");
        }
        const timeline = await zip.file("03_timeline.md")!.async("string");
        expect(timeline).toContain("Before moving home");
        expect(timeline).toContain("Date not documented");
      }
    });
  }
});
