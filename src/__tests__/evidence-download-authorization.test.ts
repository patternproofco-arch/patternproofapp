import { describe, expect, it } from "vitest";
import { fakeAdmin } from "./helpers/fake-supabase";
import { authorizeEvidenceDownload } from "@/lib/evidence-download.server";

const SURV = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const link = (over: Record<string, unknown> = {}) => ({
  include_all_incidents: false,
  include_all_evidence: false,
  scope_incidents: [] as string[],
  scope_evidence: ["ev-ok"] as string[],
  ...over,
});

function world() {
  return {
    evidence: [
      {
        id: "ev-ok",
        user_id: SURV,
        file_url: `${SURV}/photo.jpg`,
        file_type: "image",
        title: "Photo",
        deleted_at: null,
        review_status: "confirmed",
      },
      {
        id: "ev-deleted",
        user_id: SURV,
        file_url: `${SURV}/old.jpg`,
        file_type: "image",
        title: "Old",
        deleted_at: "2026-02-01T00:00:00Z",
        review_status: "confirmed",
      },
      {
        id: "ev-suggested",
        user_id: SURV,
        file_url: `${SURV}/s.jpg`,
        file_type: "image",
        title: "S",
        deleted_at: null,
        review_status: "suggested",
      },
      {
        id: "ev-missing",
        user_id: SURV,
        file_url: `${SURV}/gone.jpg`,
        file_type: "image",
        title: "Gone",
        deleted_at: null,
        review_status: "confirmed",
      },
      {
        id: "ev-foreign-path",
        user_id: SURV,
        file_url: `${OTHER}/theirs.jpg`,
        file_type: "image",
        title: "X",
        deleted_at: null,
        review_status: "confirmed",
      },
      {
        id: "ev-traversal",
        user_id: SURV,
        file_url: `${SURV}/../${OTHER}/x.jpg`,
        file_type: "image",
        title: "X",
        deleted_at: null,
        review_status: "confirmed",
      },
      {
        id: "ev-url",
        user_id: SURV,
        file_url: "https://evil.example/x.jpg",
        file_type: "image",
        title: "X",
        deleted_at: null,
        review_status: "confirmed",
      },
      {
        id: "ev-other-owner",
        user_id: OTHER,
        file_url: `${OTHER}/p.jpg`,
        file_type: "image",
        title: "O",
        deleted_at: null,
        review_status: "confirmed",
      },
    ],
  } as Record<string, Array<Record<string, unknown>>>;
}

function admin(
  stored: string[] = [
    `${SURV}/photo.jpg`,
    `${SURV}/old.jpg`,
    `${SURV}/s.jpg`,
    `${OTHER}/theirs.jpg`,
  ],
) {
  const signed: string[] = [];
  const base = fakeAdmin(world());
  return {
    signed,
    admin: {
      ...base,
      storage: {
        from: () => ({
          exists: async (p: string) => ({ data: stored.includes(p), error: null }),
          createSignedUrl: async (p: string) => {
            signed.push(p);
            return { data: { signedUrl: `https://signed.example/${p}` }, error: null };
          },
        }),
      },
    },
  };
}

const run = (a: ReturnType<typeof admin>, evidenceId: string, l = link()) =>
  authorizeEvidenceDownload({
    admin: a.admin,
    link: l,
    clientId: SURV,
    evidenceId,
    ttlSeconds: 60,
  });

describe("a professional's file download is enforced on the server", () => {
  it("gives a signed link to a file that is shared, present and confirmed", async () => {
    const a = admin();
    const r = await run(a, "ev-ok");
    expect(r).toMatchObject({ ok: true, title: "Photo" });
    expect(a.signed).toEqual([`${SURV}/photo.jpg`]);
  });

  it("refuses a file that is not in what the survivor shared, without signing anything", async () => {
    const a = admin();
    const r = await run(a, "ev-deleted"); // real file, but not in scope_evidence
    expect(r).toMatchObject({ ok: false, code: "not_shared" });
    expect(a.signed).toEqual([]);
  });

  it("refuses a file the survivor deleted, even if it is still listed in the share", async () => {
    const a = admin();
    const r = await run(a, "ev-deleted", link({ scope_evidence: ["ev-deleted"] }));
    expect(r).toMatchObject({ ok: false, code: "gone" });
    expect(a.signed).toEqual([]);
  });

  it("refuses an unconfirmed suggestion, which no list shows either", async () => {
    const a = admin();
    const r = await run(a, "ev-suggested", link({ scope_evidence: ["ev-suggested"] }));
    expect(r).toMatchObject({ ok: false, code: "gone" });
  });

  it("says plainly when a shared file is missing from storage (no dead link)", async () => {
    const a = admin();
    const r = await run(a, "ev-missing", link({ scope_evidence: ["ev-missing"] }));
    expect(r).toMatchObject({ ok: false, code: "file_missing" });
    expect((r as { message: string }).message).toMatch(/can't be found in storage/);
    expect(a.signed).toEqual([]);
  });

  it("never signs a path outside the survivor's own folder, or an absolute URL", async () => {
    for (const id of ["ev-foreign-path", "ev-traversal", "ev-url"]) {
      const a = admin();
      const r = await run(a, id, link({ scope_evidence: [id] }));
      expect(r, id).toMatchObject({ ok: false, code: "unavailable" });
      expect(a.signed, id).toEqual([]);
    }
  });

  it("does not leak another account's file even if its id is in the link", async () => {
    const a = admin();
    const r = await run(a, "ev-other-owner", link({ scope_evidence: ["ev-other-owner"] }));
    expect(r).toMatchObject({ ok: false, code: "gone" });
    expect(a.signed).toEqual([]);
  });
});
