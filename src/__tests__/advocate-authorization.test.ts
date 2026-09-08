import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";
import {
  buildAdvocateZip,
  grantIsEmpty,
  loadScopedContent,
  resolveAdvocateGrant,
} from "@/lib/advocate-packet.server";
import { buildOversightAdvocates, visibleCaseIds } from "@/lib/org-oversight.server";

const ADVOCATE = "11111111-1111-1111-1111-111111111111";
const OTHER_ADVOCATE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SURVIVOR = "22222222-2222-2222-2222-222222222222";
const OTHER_SURVIVOR = "33333333-3333-3333-3333-333333333333";
const CASE = "44444444-4444-4444-4444-444444444444";
const OTHER_CASE = "55555555-5555-5555-5555-555555555555";

const hour = 3600_000;
const future = new Date(Date.now() + 24 * hour).toISOString();
const past = new Date(Date.now() - 24 * hour).toISOString();

function link(over: Record<string, unknown> = {}) {
  return {
    id: "link-1",
    advocate_user_id: ADVOCATE,
    client_user_id: SURVIVOR,
    case_id: null,
    status: "active",
    created_at: past,
    expires_at: null,
    revoked_at: null,
    invitation_id: null,
    org_admin_visibility: false,
    include_all_incidents: false,
    include_all_evidence: false,
    include_patterns: false,
    scope_incidents: ["inc-shared"],
    scope_evidence: ["ev-shared"],
    ...over,
  };
}

function world(rows: Array<Record<string, unknown>>, extra: Partial<Tables> = {}): Tables {
  return {
    advocate_client_links: rows,
    advocate_invitations: [],
    cases: [
      {
        id: CASE,
        user_id: SURVIVOR,
        case_name: "Shared case",
        highlighted_incident_ids: ["inc-shared"],
        attached_evidence_ids: ["ev-shared"],
      },
      {
        id: OTHER_CASE,
        user_id: SURVIVOR,
        case_name: "Private case",
        highlighted_incident_ids: ["inc-private"],
        attached_evidence_ids: ["ev-private"],
      },
    ],
    incidents: [
      {
        id: "inc-shared",
        user_id: SURVIVOR,
        date: "2026-02-01",
        description: "Shared entry",
        deleted_at: null,
        abuse_types: [],
      },
      {
        id: "inc-private",
        user_id: SURVIVOR,
        date: "2026-02-02",
        description: "Private entry",
        deleted_at: null,
        abuse_types: [],
      },
      {
        id: "inc-other-user",
        user_id: OTHER_SURVIVOR,
        date: "2026-02-03",
        description: "Someone else",
        deleted_at: null,
        abuse_types: [],
      },
    ],
    evidence: [
      {
        id: "ev-shared",
        user_id: SURVIVOR,
        title: "Shared photo",
        date: "2026-02-01",
        file_url: "shared.jpg",
        file_type: "image/jpeg",
        deleted_at: null,
        review_status: "confirmed",
      },
      {
        id: "ev-private",
        user_id: SURVIVOR,
        title: "Private photo",
        date: "2026-02-02",
        file_url: "private.jpg",
        file_type: "image/jpeg",
        deleted_at: null,
        review_status: "confirmed",
      },
    ],
    advocate_profiles: [{ user_id: ADVOCATE, full_name: "A. Advocate", org_name: "Safe Harbor" }],
    ...extra,
  } as Tables;
}

describe("resolveAdvocateGrant — fails closed", () => {
  it("resolves an active grant for the right advocate and survivor", async () => {
    const admin = fakeAdmin(world([link()]));
    const g = await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    });
    expect(g?.link_id).toBe("link-1");
    expect(g?.client_user_id).toBe(SURVIVOR);
  });

  it("returns nothing for a different survivor (advocate cannot export another client)", async () => {
    const admin = fakeAdmin(world([link()]));
    const g = await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: OTHER_SURVIVOR,
    });
    expect(g).toBeNull();
  });

  it("returns nothing for a different advocate holding no link", async () => {
    const admin = fakeAdmin(world([link()]));
    const g = await resolveAdvocateGrant(admin, {
      advocateUserId: OTHER_ADVOCATE,
      clientUserId: SURVIVOR,
    });
    expect(g).toBeNull();
  });

  it("blocks a withdrawn (revoked) grant", async () => {
    const admin = fakeAdmin(world([link({ status: "revoked", revoked_at: past })]));
    expect(
      await resolveAdvocateGrant(admin, { advocateUserId: ADVOCATE, clientUserId: SURVIVOR }),
    ).toBeNull();
  });

  it("blocks an expired grant", async () => {
    const admin = fakeAdmin(world([link({ expires_at: past })]));
    expect(
      await resolveAdvocateGrant(admin, { advocateUserId: ADVOCATE, clientUserId: SURVIVOR }),
    ).toBeNull();
  });

  it("blocks when the originating invitation is revoked or expired", async () => {
    const revoked = fakeAdmin(
      world([link({ invitation_id: "inv-1" })], {
        advocate_invitations: [{ id: "inv-1", status: "revoked", expires_at: future }],
      }),
    );
    expect(
      await resolveAdvocateGrant(revoked, { advocateUserId: ADVOCATE, clientUserId: SURVIVOR }),
    ).toBeNull();

    const expired = fakeAdmin(
      world([link({ invitation_id: "inv-2" })], {
        advocate_invitations: [{ id: "inv-2", status: "accepted", expires_at: past }],
      }),
    );
    expect(
      await resolveAdvocateGrant(expired, { advocateUserId: ADVOCATE, clientUserId: SURVIVOR }),
    ).toBeNull();
  });

  it("a link that exists but is not accepted/active grants nothing (opening an invite alone)", async () => {
    const admin = fakeAdmin(world([link({ status: "pending" })]));
    expect(
      await resolveAdvocateGrant(admin, { advocateUserId: ADVOCATE, clientUserId: SURVIVOR }),
    ).toBeNull();
  });

  it("narrows a case-scoped grant to that case's own items", async () => {
    const admin = fakeAdmin(
      world([link({ case_id: CASE, include_all_incidents: true, include_all_evidence: true })]),
    );
    const g = await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    });
    expect(g?.include_all_incidents).toBe(false);
    expect(g?.scope_incidents).toEqual(["inc-shared"]);
    expect(g?.scope_evidence).toEqual(["ev-shared"]);
    expect(g?.scope_incidents).not.toContain("inc-private");
  });
});

describe("grantIsEmpty — empty scope grants zero access", () => {
  const base = {
    link_id: "l",
    advocate_user_id: ADVOCATE,
    client_user_id: SURVIVOR,
    case_id: null,
    granted_at: past,
    expires_at: null,
    revoked_at: null,
    status: "active",
    org_admin_visibility: false,
    include_patterns: false,
    invited_email: null,
    org_name: null,
  };
  it("is empty with no selections and no all-toggles", () => {
    expect(
      grantIsEmpty({
        ...base,
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: [],
        scope_evidence: [],
      }),
    ).toBe(true);
  });
  it("is not empty once anything is selected", () => {
    expect(
      grantIsEmpty({
        ...base,
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: ["inc-shared"],
        scope_evidence: [],
      }),
    ).toBe(false);
  });
});

describe("loadScopedContent — only authorized items load", () => {
  it("excludes unshared entries, unshared evidence and other survivors' rows", async () => {
    const admin = fakeAdmin(world([link()]));
    const g = (await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    }))!;
    const content = await loadScopedContent(admin, g);
    expect(content.incidents.map((i) => i.id)).toEqual(["inc-shared"]);
    expect(content.evidence.map((e) => e.id)).toEqual(["ev-shared"]);
  });

  it("loads nothing at all when the scope is empty", async () => {
    const admin = fakeAdmin(world([link({ scope_incidents: [], scope_evidence: [] })]));
    const g = (await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    }))!;
    expect(grantIsEmpty(g)).toBe(true);
    const content = await loadScopedContent(admin, g);
    expect(content.incidents).toHaveLength(0);
    expect(content.evidence).toHaveLength(0);
  });

  it("scopes every query to the survivor who granted access", async () => {
    const admin = fakeAdmin(world([link({ include_all_incidents: true })]));
    const g = (await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    }))!;
    await loadScopedContent(admin, g);
    const incidentQuery = admin.queries.find((q) => q.table === "incidents");
    expect(incidentQuery?.ops).toContain("eq:user_id");
    const rows = (await loadScopedContent(admin, g)).incidents;
    expect(rows.every((r) => r.user_id === SURVIVOR)).toBe(true);
  });
});

describe("buildAdvocateZip — real package with authorized files only", () => {
  it("produces a ZIP holding a real PDF, timeline, manifests and only shared evidence", async () => {
    const files = {
      "shared.jpg": new Uint8Array([1, 2, 3, 4]),
      "private.jpg": new Uint8Array([9, 9, 9, 9]),
    };
    const admin = fakeAdmin(world([link()]), files);
    const g = (await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    }))!;
    const content = await loadScopedContent(admin, g);
    const bytes = await buildAdvocateZip(admin, {
      grant: g,
      content,
      advocate: { full_name: "A. Advocate", org_name: "Safe Harbor", email: "a@example.org" },
      generatedAt: new Date().toISOString(),
      audience: "advocate",
      includeFiles: true,
    });

    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    expect(names).toContain("PatternProof-Advocate-Packet.pdf");
    expect(names).toContain("timeline.csv");
    expect(names).toContain("consent-manifest.json");
    expect(names).toContain("manifest.json");

    const pdf = await zip.file("PatternProof-Advocate-Packet.pdf")!.async("string");
    expect(pdf.startsWith("%PDF")).toBe(true);

    const timeline = await zip.file("timeline.csv")!.async("string");
    expect(timeline).toContain("Shared entry");
    expect(timeline).not.toContain("Private entry");

    const consent = JSON.parse(await zip.file("consent-manifest.json")!.async("string"));
    expect(consent.grant_id).toBe("link-1");
    expect(consent.status).toBe("active");
    expect(consent.scope.selected_evidence_ids).toEqual(["ev-shared"]);
    expect(consent.scope.organization_visibility).toBe(false);
    expect(typeof consent.note).toBe("string");

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest.evidence_ids).toEqual(["ev-shared"]);
    expect(manifest.files).toHaveLength(1);
    expect(admin.downloads).toEqual(["shared.jpg"]);

    const evidenceEntries = names.filter((n) => n.startsWith("evidence/") && !n.endsWith("/"));
    expect(evidenceEntries).toHaveLength(1);
    expect(evidenceEntries[0]).toContain("Shared_photo");
  });

  it("makes no legal or security claims PatternProof cannot prove", async () => {
    const admin = fakeAdmin(world([link()]));
    const g = (await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    }))!;
    const content = await loadScopedContent(admin, g);
    const zip = await JSZip.loadAsync(
      await buildAdvocateZip(admin, {
        grant: g,
        content,
        advocate: null,
        generatedAt: new Date().toISOString(),
        audience: "advocate",
        includeFiles: false,
      }),
    );
    const pdf = await zip.file("PatternProof-Advocate-Packet.pdf")!.async("string");
    for (const claim of ["court-ready", "court ready", "chain of custody", "end-to-end"]) {
      expect(pdf.toLowerCase()).not.toContain(claim);
    }
  });
});

describe("org owner/admin oversight — metadata only", () => {
  const members = [
    { user_id: ADVOCATE, role: "advocate", joined_at: past },
    { user_id: OTHER_ADVOCATE, role: "owner", joined_at: past },
  ];
  const links = [
    {
      id: "l1",
      advocate_user_id: ADVOCATE,
      client_user_id: SURVIVOR,
      case_id: CASE,
      status: "active",
      created_at: past,
      expires_at: null,
      org_admin_visibility: false,
    },
    {
      id: "l2",
      advocate_user_id: ADVOCATE,
      client_user_id: OTHER_SURVIVOR,
      case_id: OTHER_CASE,
      status: "revoked",
      created_at: past,
      expires_at: null,
      org_admin_visibility: true,
    },
  ];
  const caseNames = new Map([
    [CASE, "Shared case"],
    [OTHER_CASE, "Private case"],
  ]);

  it("hides survivor/case labels unless that survivor consented to org visibility", () => {
    const [advocate] = buildOversightAdvocates({
      members,
      links,
      names: new Map([[ADVOCATE, "A. Advocate"]]),
      caseNames,
    });
    const withoutConsent = advocate!.clients.find((c) => c.link_id === "l1")!;
    const withConsent = advocate!.clients.find((c) => c.link_id === "l2")!;
    expect(withoutConsent.identified).toBe(false);
    expect(withoutConsent.label).toMatch(/^Client \d+-\d+$/);
    expect(withoutConsent.label).not.toContain("Shared case");
    expect(withConsent.identified).toBe(true);
    expect(withConsent.label).toBe("Private case");
  });

  it("only looks up case labels for consented links", () => {
    expect(visibleCaseIds(links)).toEqual([OTHER_CASE]);
  });

  it("returns counts and assignment metadata but never content", () => {
    const [advocate] = buildOversightAdvocates({
      members,
      links,
      names: new Map([[ADVOCATE, "A. Advocate"]]),
      caseNames,
    });
    expect(advocate!.open_clients).toBe(1);
    expect(advocate!.closed_clients).toBe(1);
    const serialised = JSON.stringify(advocate);
    for (const leak of ["Shared entry", "Private entry", "description", "file_url", SURVIVOR]) {
      expect(serialised).not.toContain(leak);
    }
  });

  it("an owner with no advocate link of their own carries no clients", () => {
    const advocates = buildOversightAdvocates({
      members,
      links,
      names: new Map(),
      caseNames,
    });
    const owner = advocates.find((a) => a.user_id === OTHER_ADVOCATE)!;
    expect(owner.clients).toEqual([]);
    expect(owner.open_clients).toBe(0);
  });
});

describe("caseOutsideGrant — wrong case is blocked", () => {
  it("rejects a case id the grant does not cover and accepts the one it does", async () => {
    const { caseOutsideGrant } = await import("@/lib/advocate-packet.server");
    const admin = fakeAdmin(world([link({ case_id: CASE })]));
    const g = (await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    }))!;
    expect(caseOutsideGrant(g, OTHER_CASE)).toBe(true);
    expect(caseOutsideGrant(g, CASE)).toBe(false);
  });

  it("rejects any case id when the grant is not case-scoped", async () => {
    const admin = fakeAdmin(world([link({ case_id: null })]));
    const g = (await resolveAdvocateGrant(admin, {
      advocateUserId: ADVOCATE,
      clientUserId: SURVIVOR,
    }))!;
    expect(caseOutsideGrant(g, CASE)).toBe(true);
    expect(caseOutsideGrant(g, null)).toBe(false);
  });
});
