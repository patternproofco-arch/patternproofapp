import { describe, expect, it } from "vitest";
import { deriveGrantMetrics } from "@/lib/grant-report-derive";

const P = { from: "2026-01-01", to: "2026-06-30" };
const IN = "2026-03-10T12:00:00.000Z";
const IN2 = "2026-04-02T09:00:00.000Z";
const BEFORE = "2025-12-31T23:59:59.999Z";
const AFTER = "2026-07-01T00:00:00.000Z";

describe("unique survivors vs service events", () => {
  it("one survivor with three follow-ups is one person and three events", () => {
    const { derived } = deriveGrantMetrics({
      ...P,
      links: [],
      referrals: [],
      followUps: [
        { survivor_user_id: "a", status: "open", created_at: IN, updated_at: IN },
        { survivor_user_id: "a", status: "open", created_at: IN2, updated_at: IN2 },
        { survivor_user_id: "a", status: "open", created_at: IN2, updated_at: IN2 },
      ],
    });
    expect(derived.follow_ups_created).toBe(3);
    expect(derived.clients_with_follow_up).toBe(1);
    expect(derived.clients_with_activity).toBe(1);
  });

  it("a survivor in links, follow-ups and referrals is counted once overall", () => {
    const { derived } = deriveGrantMetrics({
      ...P,
      links: [{ client_user_id: "a", created_at: IN, revoked_at: null }],
      followUps: [{ survivor_user_id: "a", status: "open", created_at: IN, updated_at: IN }],
      referrals: [{ survivor_user_id: "a", created_at: IN }],
    });
    expect(derived.clients_with_activity).toBe(1);
    expect(derived.referrals_recorded).toBe(1);
    expect(derived.clients_referred).toBe(1);
  });

  it("two grants for the same survivor are two events and one person", () => {
    const { derived } = deriveGrantMetrics({
      ...P,
      links: [
        { client_user_id: "a", created_at: IN, revoked_at: null },
        { client_user_id: "a", created_at: IN2, revoked_at: null },
      ],
      followUps: [],
      referrals: [],
    });
    expect(derived.access_grants_started).toBe(2);
    expect(derived.clients_who_shared_records).toBe(1);
  });
});

describe("period handling", () => {
  it("includes the first and last instant of the period and nothing outside", () => {
    const { derived } = deriveGrantMetrics({
      ...P,
      links: [],
      followUps: [],
      referrals: [
        { survivor_user_id: "a", created_at: "2026-01-01T00:00:00.000Z" },
        { survivor_user_id: "b", created_at: "2026-06-30T23:59:59.999Z" },
        { survivor_user_id: "c", created_at: BEFORE },
        { survivor_user_id: "d", created_at: AFTER },
      ],
    });
    expect(derived.referrals_recorded).toBe(2);
    expect(derived.clients_referred).toBe(2);
  });

  it("access ended in the period counts unique survivors, and says nothing about cases closed", () => {
    const { derived } = deriveGrantMetrics({
      ...P,
      links: [
        { client_user_id: "a", created_at: BEFORE, revoked_at: IN },
        { client_user_id: "a", created_at: BEFORE, revoked_at: IN2 },
        { client_user_id: "b", created_at: BEFORE, revoked_at: AFTER },
        { client_user_id: "c", created_at: BEFORE, revoked_at: null },
      ],
      followUps: [],
      referrals: [],
    });
    expect(derived.access_ended).toBe(1);
    expect(derived.clients_with_activity).toBe(0);
    expect(Object.keys(derived)).not.toContain("cases_closed");
  });
});

describe("zero is a real answer and gaps are said out loud", () => {
  it("an empty period gives zeros, not nulls", () => {
    const { derived, caveats } = deriveGrantMetrics({ ...P, links: [], followUps: [], referrals: [] });
    for (const v of Object.values(derived)) expect(v).toBe(0);
    expect(caveats).toEqual([]);
  });

  it("events with no survivor attached are counted but flagged", () => {
    const { derived, caveats } = deriveGrantMetrics({
      ...P,
      links: [],
      followUps: [{ survivor_user_id: null, status: "open", created_at: IN, updated_at: IN }],
      referrals: [{ survivor_user_id: null, created_at: IN }],
    });
    expect(derived.follow_ups_created).toBe(1);
    expect(derived.referrals_recorded).toBe(1);
    expect(derived.clients_with_activity).toBe(0);
    expect(caveats.join(" ")).toMatch(/no survivor attached/);
  });

  it("explains that 'done' is the last-changed date", () => {
    const { derived, caveats } = deriveGrantMetrics({
      ...P,
      links: [],
      referrals: [],
      followUps: [{ survivor_user_id: "a", status: "done", created_at: BEFORE, updated_at: IN }],
    });
    expect(derived.follow_ups_completed).toBe(1);
    expect(caveats.join(" ")).toMatch(/last changed/);
  });
});
