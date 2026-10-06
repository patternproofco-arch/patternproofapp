import { describe, expect, it } from "vitest";
import { createPackageVersion } from "@/lib/chronology-workspace.server";
import {
  ClioHttpError,
  MAX_ATTEMPTS,
  STALE_UPLOAD_MS,
  getJob,
  previewTransfer,
  retryItem,
  runStep,
  startTransfer,
  type ClioApi,
  type JobView,
  type TransferDeps,
} from "@/lib/clio-transfer.server";
import { planTransfer } from "@/lib/clio-transfer-plan";
import { buildChronology } from "@/lib/chronology";
import { planNextPackage, type ExhibitPackage } from "@/lib/exhibit-numbering";
import { itemRefs } from "@/lib/chronology";
import { makeRwAdmin, type Tables } from "./helpers/fake-rw-supabase";

const ATTY = "atty-1";
const CLIENT = "client-1";
const LINK = "link-1";

const inc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  title: `Entry ${id}`,
  date: "2026-03-03",
  date_precision: "exact",
  description: `Text of ${id}`,
  created_at: "2026-03-04T10:00:00Z",
  deleted_at: null,
  source: "manual",
  confirmed_at: null,
  ...over,
});
const ev = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  title: `File ${id}`,
  date: "2026-03-05",
  date_precision: "exact",
  description: `About ${id}`,
  created_at: "2026-03-06T10:00:00Z",
  deleted_at: null,
  review_status: "confirmed",
  file_url: `${CLIENT}/${id}.pdf`,
  ...over,
});

const FILE_BYTES = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);

function seed(over: Partial<Tables> = {}) {
  return makeRwAdmin(
    {
      attorney_client_links: [
        {
          id: LINK,
          attorney_user_id: ATTY,
          client_user_id: CLIENT,
          status: "active",
          revoked_at: null,
          expires_at: null,
          clio_share_consent: true,
          include_all_incidents: false,
          include_all_evidence: false,
          scope_incidents: ["a", "b"],
          scope_evidence: ["f"],
          case_id: null,
        },
      ],
      clio_matter_links: [
        {
          attorney_client_link_id: LINK,
          clio_matter_id: "m-1",
          clio_matter_display_number: "00123-Roe",
          clio_matter_description: "Roe v. Doe",
          unlinked_at: null,
        },
      ],
      incidents: [inc("a", { date: "2026-02-01" }), inc("b", { date: "2026-03-01" })],
      evidence: [ev("f")],
      attorney_document_requests: [],
      attorney_exhibit_packages: [],
      attorney_declaration_drafts: [],
      case_collaborators: [],
      case_grants: [],
      clio_transfer_jobs: [],
      clio_transfer_items: [],
      ...over,
    },
    {
      uniques: {
        attorney_exhibit_packages: ["link_id", "version"],
        clio_transfer_items: ["job_id", "document_name"],
      },
    },
  );
}

type Sent = { id: string; name: string; bytes: Uint8Array; confirmed: boolean };

function fakeClio(opts: { failPut?: (name: string, n: number) => ClioHttpError | null; failCreate?: (name: string) => ClioHttpError | null } = {}) {
  const docs: Sent[] = [];
  const attempts = new Map<string, number>();
  let seq = 0;
  const api = (): ClioApi => ({
    async createDocument(name) {
      const f = opts.failCreate?.(name);
      if (f) throw f;
      const id = `doc-${++seq}`;
      docs.push({ id, name, bytes: new Uint8Array(), confirmed: false });
      return { id, versionUuid: `v-${id}`, putUrl: `https://put/${id}`, putHeaders: {} };
    },
    async putBytes(target, bytes) {
      const doc = docs.find((d) => target.putUrl.endsWith(d.id))!;
      const n = (attempts.get(doc.name) ?? 0) + 1;
      attempts.set(doc.name, n);
      const f = opts.failPut?.(doc.name, n);
      if (f) throw f;
      doc.bytes = bytes;
    },
    async markFullyUploaded(id) {
      docs.find((d) => d.id === id)!.confirmed = true;
    },
  });
  return { docs, api };
}

function deps(clio: ReturnType<typeof fakeClio>, over: Partial<TransferDeps> = {}, clock = { t: Date.parse("2026-10-04T12:00:00Z") }): TransferDeps {
  return {
    getToken: async () => "tok",
    makeApi: () => clio.api(),
    downloadEvidence: async () => FILE_BYTES,
    buildZip: async () => new Uint8Array([80, 75]),
    sha256: async (b) =>
      Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b as unknown as BufferSource)))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
    now: () => new Date(clock.t),
    ...over,
  };
}

async function setup(over: Partial<Tables> = {}) {
  const admin = seed(over);
  await createPackageVersion(admin, ATTY, CLIENT);
  return admin;
}

async function drain(admin: ReturnType<typeof seed>, d: TransferDeps, jobId: string, max = 40): Promise<JobView> {
  let v = await runStep(admin, d, ATTY, jobId);
  for (let i = 0; i < max && v.status === "running"; i++) {
    const before = JSON.stringify(v.items.map((x) => [x.status, x.attempts]));
    v = await runStep(admin, d, ATTY, jobId);
    if (JSON.stringify(v.items.map((x) => [x.status, x.attempts])) === before && v.status === "running") break;
  }
  return v;
}

describe("the plan", () => {
  const pkgOf = (incidents: object[], evidence: object[] = []): ExhibitPackage => {
    const v = planNextPackage(itemRefs(incidents as never, evidence as never, []), null);
    return { version: v.version, entries: v.entries };
  };

  it("one named document per numbered exhibit, then the index, then the optional ZIP", () => {
    const incs = [inc("a", { date: "2026-02-01" }), inc("b", { date: "2026-03-01" })];
    const rows = buildChronology(incs, [ev("f")], [], pkgOf(incs, [ev("f")]));
    const plan = planTransfer({
      rows,
      packageVersion: 1,
      files: new Map([["f", { extension: "pdf" }]]),
      prior: [],
      includeZip: true,
    });
    expect(plan.items.map((i) => i.documentName)).toEqual([
      "Exhibit 001 - 2026-02-01 - Entry a.txt",
      "Exhibit 002 - 2026-03-01 - Entry b.txt",
      "Exhibit 003 - 2026-03-05 - File f.pdf",
      "Exhibit Index - package v1.txt",
      "Exhibit Binder - package v1.zip",
    ]);
    expect(plan.excluded).toEqual([]);
  });

  it("an item with no fixed number is listed as not sent, never given a number", () => {
    const incs = [inc("a")];
    const pkg = pkgOf(incs);
    const rows = buildChronology([...incs, inc("late", { date: "2026-01-01" })], [], [], pkg);
    const plan = planTransfer({ rows, packageVersion: 1, files: new Map(), prior: [], includeZip: false });
    expect(plan.items.filter((i) => i.kind === "exhibit")).toHaveLength(1);
    expect(plan.excluded).toHaveLength(1);
    expect(plan.excluded[0]).toMatchObject({ itemKey: "incident:late", reason: "not_numbered" });
  });

  it("a changed exhibit goes beside the earlier copy, never over it", () => {
    const incs = [inc("a")];
    const rows = buildChronology(incs, [], [], pkgOf(incs));
    const plan = planTransfer({
      rows,
      packageVersion: 1,
      files: new Map(),
      prior: [{ documentName: "Exhibit 001 - 2026-03-03 - Entry a.txt", marker: "an-older-marker" }],
      includeZip: false,
    });
    expect(plan.items[0]!.documentName).toBe("Exhibit 001 - 2026-03-03 - Entry a (revised).txt");
    expect(plan.items[0]!.note).toMatch(/earlier copy in Clio is left as it is/);
  });

  it("awkward titles can't produce a bad file name", () => {
    const incs = [inc("a", { title: 'Re: "plans" / <n>\\ok?*|' + "x".repeat(300) })];
    const rows = buildChronology(incs, [], [], pkgOf(incs));
    const name = planTransfer({ rows, packageVersion: 1, files: new Map(), prior: [], includeZip: false }).items[0]!.documentName;
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith(".txt")).toBe(true);
  });
});

describe("reviewing before anything is sent", () => {
  it("needs fixed exhibit numbers first", async () => {
    await expect(previewTransfer(seed(), ATTY, { linkId: LINK, includeZip: false })).rejects.toThrow(/Fix the exhibit numbers first/);
  });

  it("needs the survivor's Clio approval and a linked matter", async () => {
    const admin = await setup();
    admin.tables.attorney_client_links![0]!.clio_share_consent = false;
    await expect(previewTransfer(admin, ATTY, { linkId: LINK, includeZip: false })).rejects.toThrow(/hasn't approved Clio sharing/);
    admin.tables.attorney_client_links![0]!.clio_share_consent = true;
    admin.tables.clio_matter_links![0]!.unlinked_at = "2026-05-01T00:00:00Z";
    await expect(previewTransfer(admin, ATTY, { linkId: LINK, includeZip: false })).rejects.toThrow(/Link this case to a Clio matter/);
  });

  it("names the matter and lists what will and won't go", async () => {
    const admin = await setup();
    admin.tables.incidents!.push(inc("late", { date: "2026-01-01" }));
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).push("late");
    const p = await previewTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    expect(p.matterLabel).toBe("00123-Roe · Roe v. Doe");
    expect(p.plan.items.filter((i) => i.kind === "exhibit")).toHaveLength(3);
    expect(p.plan.excluded.map((e) => e.itemKey)).toEqual(["incident:late"]);
  });

  it("only the attorney who owns the link can preview", async () => {
    const admin = await setup();
    await expect(previewTransfer(admin, "someone-else", { linkId: LINK, includeZip: false })).rejects.toThrow(/isn't active for your account/);
  });
});

describe("sending", () => {
  it("sends every exhibit, then the index, each once, and confirms each before saying so", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    expect(job.counts).toMatchObject({ total: 4, confirmed: 0 });
    const done = await drain(admin, d, job.id);

    expect(done.status).toBe("completed");
    expect(done.counts).toMatchObject({ total: 4, confirmed: 4, failed: 0 });
    expect(done.summary).toMatch(/All 4 documents are in Clio/);
    expect(clio.docs.map((x) => x.name)).toEqual([
      "Exhibit 001 - 2026-02-01 - Entry a.txt",
      "Exhibit 002 - 2026-03-01 - Entry b.txt",
      "Exhibit 003 - 2026-03-05 - File f.pdf",
      "Exhibit Index - package v1.txt",
    ]);
    expect(clio.docs.every((x) => x.confirmed)).toBe(true);
    expect(new Set(clio.docs.map((x) => x.name)).size).toBe(clio.docs.length);
  });

  it("the evidence file goes as the original bytes; the index carries each file's fingerprint and no authenticity claim", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    await drain(admin, d, job.id);
    const file = clio.docs.find((x) => x.name.endsWith(".pdf"))!;
    expect(Array.from(file.bytes)).toEqual(Array.from(FILE_BYTES));
    const index = new TextDecoder().decode(clio.docs.find((x) => x.name.startsWith("Exhibit Index"))!.bytes);
    expect(index).toContain(await d.sha256(FILE_BYTES));
    expect(index).toMatch(/does not show that the file is genuine/);
    // The only mentions of these words are the disclaimers saying we make no such claim.
    const claims = index
      .toLowerCase()
      .replace(/does not state that anything is authentic, complete, admissible or accurate/g, "")
      .replace(/not verified/g, "");
    expect(claims).not.toMatch(/authentic|verified|admissible|certif/);
  });

  it("a file that can't be read is reported as not sent, never skipped quietly, and the rest still go", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio, { downloadEvidence: async () => null });
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    const done = await drain(admin, d, job.id);
    expect(done.status).toBe("completed_with_errors");
    const bad = done.items.find((i) => i.documentName.endsWith(".pdf"))!;
    expect(bad.status).toBe("failed");
    expect(bad.errorMessage).toMatch(/NOT sent/);
    expect(bad.attempts).toBe(MAX_ATTEMPTS); // not pointlessly retried
    expect(clio.docs.map((x) => x.name)).not.toContain(bad.documentName);
    expect(done.counts.confirmed).toBe(3);
    expect(done.summary).toMatch(/did NOT go to Clio/);
    const index = new TextDecoder().decode(clio.docs.find((x) => x.name.startsWith("Exhibit Index"))!.bytes);
    expect(index).toMatch(/File in Clio: Exhibit 003 .*\n\s+Transfer status when this index was made: failed/);
  });

  it("retries a temporary Clio failure a bounded number of times, then stops and says so", async () => {
    const admin = await setup();
    const clio = fakeClio({ failPut: (name) => (name.includes("Entry b") ? new ClioHttpError(503, "down") : null) });
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    const done = await drain(admin, d, job.id);
    const b = done.items.find((i) => i.documentName.includes("Entry b"))!;
    expect(b.status).toBe("failed");
    expect(b.attempts).toBe(MAX_ATTEMPTS);
    expect(b.errorMessage).toMatch(/problem on its side/);
    expect(b.orphanClioDocumentIds).toHaveLength(MAX_ATTEMPTS);
    expect(b.errorMessage).toMatch(/partly uploaded document may remain in Clio/);
    expect(done.counts.confirmed).toBe(3);
  });

  it("after a failure is fixed, retrying sends only what's missing: nothing is sent twice", async () => {
    const admin = await setup();
    let broken = true;
    const clio = fakeClio({ failPut: (name) => (broken && name.includes("Entry b") ? new ClioHttpError(500, "x") : null) });
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    const first = await drain(admin, d, job.id);
    const failed = first.items.find((i) => i.status === "failed")!;
    broken = false;
    await retryItem(admin, ATTY, { jobId: job.id, itemId: failed.id });
    const done = await drain(admin, d, job.id);
    expect(done.status).toBe("completed");
    const confirmed = clio.docs.filter((x) => x.confirmed).map((x) => x.name);
    expect(new Set(confirmed).size).toBe(confirmed.length); // each name confirmed exactly once
    expect(confirmed.filter((n) => n.includes("Entry a"))).toHaveLength(1);
  });

  it("two tabs stepping at once can't send the same document twice", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    await Promise.all([runStep(admin, d, ATTY, job.id), runStep(admin, d, ATTY, job.id), runStep(admin, d, ATTY, job.id)]);
    const names = clio.docs.map((x) => x.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("another attorney can't see or drive someone else's transfer", async () => {
    const admin = await setup();
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    await expect(getJob(admin, deps(fakeClio()), "intruder", job.id)).rejects.toThrow(/wasn't found/);
    await expect(runStep(admin, deps(fakeClio()), "intruder", job.id)).rejects.toThrow(/wasn't found/);
  });
});

describe("permissions are checked again on every step", () => {
  async function started() {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    await runStep(admin, d, ATTY, job.id); // first document goes
    return { admin, clio, d, job };
  }

  it("stops, and sends nothing more, if the survivor ends sharing partway", async () => {
    const { admin, clio, d, job } = await started();
    const sentBefore = clio.docs.length;
    admin.tables.attorney_client_links![0]!.revoked_at = "2026-10-04T12:05:00Z";
    const v = await runStep(admin, d, ATTY, job.id);
    expect(v.status).toBe("stopped");
    expect(v.stopReason).toMatch(/isn't active for your account/);
    expect(clio.docs).toHaveLength(sentBefore);
    expect((await runStep(admin, d, ATTY, job.id)).status).toBe("stopped");
    expect(clio.docs).toHaveLength(sentBefore);
  });

  it("stops if the survivor withdraws Clio approval", async () => {
    const { admin, clio, d, job } = await started();
    const sent = clio.docs.length;
    admin.tables.attorney_client_links![0]!.clio_share_consent = false;
    const v = await runStep(admin, d, ATTY, job.id);
    expect(v.status).toBe("stopped");
    expect(v.stopReason).toMatch(/hasn't approved Clio sharing/);
    expect(clio.docs).toHaveLength(sent);
  });

  it("stops if the case is linked to a different matter", async () => {
    const { admin, clio, d, job } = await started();
    const sent = clio.docs.length;
    admin.tables.clio_matter_links![0]!.clio_matter_id = "m-OTHER";
    const v = await runStep(admin, d, ATTY, job.id);
    expect(v.status).toBe("stopped");
    expect(v.stopReason).toMatch(/matter changed/);
    expect(clio.docs).toHaveLength(sent);
  });

  it("stops and says to reconnect when Clio is disconnected or refuses access", async () => {
    const { admin, clio, job } = await started();
    const gone = await runStep(admin, deps(clio, { getToken: async () => null }), ATTY, job.id);
    expect(gone.status).toBe("stopped");
    expect(gone.stopReason).toMatch(/Clio isn't connected/);

    const admin2 = await setup();
    const clio2 = fakeClio({ failCreate: () => new ClioHttpError(401, "no") });
    const j2 = await startTransfer(admin2, ATTY, { linkId: LINK, includeZip: false });
    const v = await runStep(admin2, deps(clio2), ATTY, j2.id);
    expect(v.status).toBe("stopped");
    expect(v.stopReason).toMatch(/Reconnect Clio/);
  });

  it("an exhibit that changed after the transfer started is not sent", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    admin.tables.incidents!.find((i) => i.id === "b")!.description = "The survivor changed this after the transfer began.";
    const done = await drain(admin, d, job.id);
    const b = done.items.find((i) => i.documentName.includes("Entry b"))!;
    expect(b.status).toBe("failed");
    expect(b.errorMessage).toMatch(/changed after you started/);
    expect(clio.docs.map((x) => x.name).some((n) => n.includes("Entry b"))).toBe(false);
  });

  it("an exhibit the survivor stopped sharing is skipped, not sent", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).splice(1, 1); // b withdrawn
    const done = await drain(admin, d, job.id);
    const b = done.items.find((i) => i.documentName.includes("Entry b"))!;
    expect(b.status).toBe("skipped");
    expect(b.errorMessage).toMatch(/no longer shares/);
    expect(clio.docs.map((x) => x.name).some((n) => n.includes("Entry b"))).toBe(false);
  });
});

describe("not duplicating or overwriting", () => {
  it("a second transfer skips exhibits already sent with identical content", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const first = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    await drain(admin, d, first.id);
    const before = clio.docs.length;

    const second = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    expect(second.items.filter((i) => i.kind === "exhibit").every((i) => i.status === "skipped")).toBe(true);
    const done = await drain(admin, d, second.id);
    // Only the index (a different job's own record) is new; no exhibit was sent again.
    expect(clio.docs.length - before).toBeLessThanOrEqual(1);
    expect(done.items.filter((i) => i.kind === "exhibit").every((i) => i.note?.match(/Already in Clio/))).toBe(true);
  });

  it("blocks a new transfer until changed items are reviewed into a new package version", async () => {
    const admin = await setup();
    admin.tables.incidents!.find((i) => i.id === "a")!.description = "Edited by the survivor later.";
    await expect(startTransfer(admin, ATTY, { linkId: LINK, includeZip: false })).rejects.toThrow(
      /changed after exhibit package v1/,
    );
  });

  it("an edited exhibit is sent next to the earlier copy after a new package version; the earlier one is untouched", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const first = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    await drain(admin, d, first.id);
    const original = clio.docs.find((x) => x.name.includes("Entry a"))!;
    const originalBytes = Array.from(original.bytes);

    admin.tables.incidents!.find((i) => i.id === "a")!.description = "Edited by the survivor later.";
    await createPackageVersion(admin, ATTY, CLIENT); // review + refresh markers; numbers stay
    const second = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    expect(second.packageVersion).toBe(2);
    await drain(admin, d, second.id);
    const names = clio.docs.map((x) => x.name);
    expect(names.filter((n) => n.includes("Entry a"))).toHaveLength(2);
    expect(names.some((n) => n.includes("Entry a (revised)"))).toBe(true);
    expect(Array.from(original.bytes)).toEqual(originalBytes);
  });

  it("an upload left 'uploading' by a crash is not retried on its own, because Clio may already have it", async () => {
    const admin = await setup();
    const clock = { t: Date.parse("2026-10-04T12:00:00Z") };
    const clio = fakeClio();
    const d = deps(clio, {}, clock);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    const stuck = admin.tables.clio_transfer_items!.find((i) => i.job_id === job.id && i.seq === 1)!;
    stuck.status = "uploading";
    stuck.started_at = new Date(clock.t).toISOString();
    clock.t += STALE_UPLOAD_MS + 1000;
    const v = await getJob(admin, d, ATTY, job.id);
    const it = v.items.find((i) => i.seq === 1)!;
    expect(it.status).toBe("needs_review");
    expect(it.errorMessage).toMatch(/don't know whether this reached Clio/);

    await expect(retryItem(admin, ATTY, { jobId: job.id, itemId: it.id })).rejects.toThrow(/Check the matter in Clio first/);
    await retryItem(admin, ATTY, { jobId: job.id, itemId: it.id, confirmNotInClio: true });
    const done = await drain(admin, d, job.id);
    expect(done.status).toBe("completed");
  });

  it("only documents that didn't go through can be retried", async () => {
    const admin = await setup();
    const clio = fakeClio();
    const d = deps(clio);
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: false });
    const done = await drain(admin, d, job.id);
    await expect(retryItem(admin, ATTY, { jobId: job.id, itemId: done.items[0]!.id })).rejects.toThrow(/Only a document that didn't go through/);
  });
});

describe("the optional ZIP", () => {
  it("is built only from exhibits that were actually sent", async () => {
    const admin = await setup();
    const clio = fakeClio();
    let zipped: string[] = [];
    const d = deps(clio, {
      downloadEvidence: async () => null, // the file can't be read
      buildZip: async ({ rows }) => {
        zipped = rows.map((r) => r.key);
        return new Uint8Array([1]);
      },
    });
    const job = await startTransfer(admin, ATTY, { linkId: LINK, includeZip: true });
    const done = await drain(admin, d, job.id);
    expect(zipped.sort()).toEqual(["incident:a", "incident:b"]);
    expect(zipped).not.toContain("evidence:f");
    expect(done.items.find((i) => i.documentName.endsWith(".zip"))!.status).toBe("confirmed");
  });
});
