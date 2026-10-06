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

  it("a done task with no recorded completion date is left out and named, never dated by its last edit", () => {
    const { derived, caveats } = deriveGrantMetrics({
      ...P,
      links: [],
      referrals: [],
      followUps: [{ survivor_user_id: "a", status: "done", created_at: BEFORE, updated_at: IN, completed_at: null }],
    });
    expect(derived.follow_ups_completed).toBe(0);
    expect(caveats.join(" ")).toMatch(/1 follow-up\(s\) are marked done but have no recorded completion date/);
    expect(caveats.join(" ")).toMatch(/rather than dated by their last edit/);
  });
});

describe("completed counts use the actual completion date", () => {
  it("editing an old completed task does not count it in a later period", () => {
    const task = {
      survivor_user_id: "a",
      status: "done",
      created_at: "2025-11-01T15:00:00.000Z",
      completed_at: "2025-12-15T15:00:00.000Z", // finished last period
      updated_at: IN, // note edited this period
    };
    const now = deriveGrantMetrics({ ...P, links: [], referrals: [], followUps: [task] });
    expect(now.derived.follow_ups_completed).toBe(0);
    const then = deriveGrantMetrics({
      from: "2025-10-01",
      to: "2025-12-31",
      links: [],
      referrals: [],
      followUps: [task],
    });
    expect(then.derived.follow_ups_completed).toBe(1);
  });

  it("counts a task completed in the period even if it hasn't been touched since", () => {
    const { derived, caveats } = deriveGrantMetrics({
      ...P,
      links: [],
      referrals: [],
      followUps: [
        { survivor_user_id: "a", status: "completed", created_at: BEFORE, updated_at: IN, completed_at: IN },
        { survivor_user_id: "b", status: "open", created_at: IN, updated_at: IN, completed_at: null },
      ],
    });
    expect(derived.follow_ups_completed).toBe(1);
    expect(caveats).toEqual([]);
  });

  it("a reopened task (not done) is not counted even if it has an old completion date", () => {
    const { derived } = deriveGrantMetrics({
      ...P,
      links: [],
      referrals: [],
      followUps: [{ survivor_user_id: "a", status: "open", created_at: BEFORE, updated_at: IN, completed_at: IN }],
    });
    expect(derived.follow_ups_completed).toBe(0);
  });

  it("when completion dates aren't recorded yet, the count is unknown (null), not zero and not a guess", () => {
    const { derived, caveats } = deriveGrantMetrics({
      ...P,
      completionDates: "unavailable",
      links: [],
      referrals: [],
      followUps: [{ survivor_user_id: "a", status: "done", created_at: IN, updated_at: IN }],
    });
    expect(derived.follow_ups_completed).toBeNull();
    expect(derived.follow_ups_created).toBe(1);
    expect(caveats.join(" ")).toMatch(/can't be counted yet/);
  });
});

describe("the period is read in the report's time zone", () => {
  const lateJune30Eastern = "2026-07-01T01:30:00.000Z"; // Jun 30, 9:30 pm EDT

  it("work done late on the last day (Eastern) is in an Eastern period", () => {
    const followUps = [
      { survivor_user_id: "a", status: "done", created_at: IN, updated_at: IN, completed_at: lateJune30Eastern },
    ];
    const referrals = [{ survivor_user_id: "b", created_at: lateJune30Eastern }];
    const et = deriveGrantMetrics({ ...P, timeZone: "America/New_York", links: [], followUps, referrals });
    expect(et.derived.follow_ups_completed).toBe(1);
    expect(et.derived.referrals_recorded).toBe(1);
    const utc = deriveGrantMetrics({ ...P, timeZone: "UTC", links: [], followUps, referrals });
    expect(utc.derived.follow_ups_completed).toBe(0);
    expect(utc.derived.referrals_recorded).toBe(0);
  });

  it("early on the first day in UTC is still the previous day in Eastern", () => {
    const early = "2026-01-01T03:00:00.000Z"; // Dec 31, 10 pm EST
    const et = deriveGrantMetrics({
      ...P,
      timeZone: "America/New_York",
      links: [{ client_user_id: "a", created_at: early, revoked_at: null }],
      followUps: [],
      referrals: [],
    });
    expect(et.derived.access_grants_started).toBe(0);
  });
});
