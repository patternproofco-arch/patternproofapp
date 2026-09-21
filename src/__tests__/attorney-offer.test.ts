import { describe, expect, it } from "vitest";
import { ATTORNEY_PLANS, matchesAdvertisedPrice } from "@/lib/attorney-offer";
import {
  hasFreeCaseAccess,
  validateOfferCheckout,
  activeSubscription,
} from "@/lib/attorney-offer.server";
import { nextNurtureDate, NURTURE_DAYS } from "@/lib/attorney-nurture";
import { buildAttorneyResource } from "@/lib/attorney-kit.server";
import { PDFDocument } from "pdf-lib";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";
import { firmSeatsForSubscription } from "@/lib/firm-seats";

function world(): Tables {
  return {
    attorney_conversion_settings: [
      { id: 1, enabled: true, nurture_enabled: false, payment_environment: "live" },
    ],
    attorney_conversion_accounts: [
      {
        user_id: "attorney",
        approved_at: "2026-09-19",
        free_matter_id: "matter",
        free_link_id: "link",
        free_case_id: "case",
      },
    ],
    attorney_client_links: [
      {
        id: "link",
        attorney_user_id: "attorney",
        client_user_id: "client",
        status: "active",
        case_id: "case",
        expires_at: null,
      },
    ],
  };
}
const price = (amount = 6900) => ({
  active: true,
  currency: "usd",
  unit_amount: amount,
  recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
});

describe("attorney offer boundaries", () => {
  it("uses Grace's approved four monthly prices", () =>
    expect(ATTORNEY_PLANS.map((p) => p.monthly)).toEqual([69, 49, 229, 369]));
  it("checks currency, recurring cadence, active status, and exact amount before checkout", () => {
    expect(matchesAdvertisedPrice(price(), "attorney_solo_v2_monthly")).toBe(true);
    for (const bad of [
      price(4900),
      { ...price(), currency: "eur" },
      { ...price(), active: false },
      { ...price(), recurring: null },
      { ...price(), recurring: { interval: "year", interval_count: 1 } },
    ]) {
      expect(matchesAdvertisedPrice(bad, "attorney_solo_v2_monthly")).toBe(false);
    }
  });
  it("allows only the claimed client and case", async () => {
    const db = fakeAdmin(world()) as any;
    expect(await hasFreeCaseAccess(db, "attorney", "client")).toBe(true);
    expect(await hasFreeCaseAccess(db, "attorney", "other-client")).toBe(false);
    expect(await hasFreeCaseAccess(db, "other-attorney", "client")).toBe(false);
  });
  it.each(["revoked", "paused", "pending"])("refuses a %s grant", async (status) => {
    const tables = world();
    tables.attorney_client_links[0].status = status;
    expect(await hasFreeCaseAccess(fakeAdmin(tables) as any, "attorney", "client")).toBe(false);
  });
  it("refuses expired, widened, unapproved, or disabled free access", async () => {
    for (const mutate of [
      (t: Tables) => {
        t.attorney_client_links[0].expires_at = "2020-01-01";
      },
      (t: Tables) => {
        t.attorney_client_links[0].case_id = null;
      },
      (t: Tables) => {
        t.attorney_conversion_accounts[0].approved_at = null;
      },
      (t: Tables) => {
        t.attorney_conversion_settings[0].enabled = false;
      },
    ]) {
      const tables = world();
      mutate(tables);
      expect(await hasFreeCaseAccess(fakeAdmin(tables) as any, "attorney", "client")).toBe(false);
    }
  });
  it("blocks activation without configuration and discounts without approval", async () => {
    await expect(
      validateOfferCheckout(
        fakeAdmin({}) as any,
        "attorney",
        "live",
        "attorney_solo_v2_monthly",
        price(),
      ),
    ).rejects.toThrow("not available");
    await expect(
      validateOfferCheckout(
        fakeAdmin(world()) as any,
        "attorney",
        "sandbox",
        "attorney_solo_v2_monthly",
        price(),
      ),
    ).rejects.toThrow("not available");
    await expect(
      validateOfferCheckout(
        fakeAdmin(world()) as any,
        "attorney",
        "live",
        "attorney_legal_aid_v2_monthly",
        price(4900),
      ),
    ).rejects.toThrow("requires approval");
    await expect(
      validateOfferCheckout(
        fakeAdmin(world()) as any,
        "attorney",
        "live",
        "attorney_solo_v2_monthly",
        price(),
      ),
    ).resolves.toBeUndefined();
  });
  it("does not treat malformed expiry or an indefinitely canceled plan as paid", () => {
    expect(activeSubscription({ status: "canceled", current_period_end: null })).toBe(false);
    expect(activeSubscription({ status: "active", current_period_end: "bad-date" })).toBe(false);
  });
  it("grants 5 Practice seats and 10 Firm seats without changing legacy firm seats", () => {
    expect(
      firmSeatsForSubscription({ priceId: "attorney_practice_v2_monthly", status: "active" }),
    ).toBe(5);
    expect(
      firmSeatsForSubscription({ priceId: "attorney_firm_v2_monthly", status: "active" }),
    ).toBe(10);
    expect(firmSeatsForSubscription({ priceId: "attorney_firm_monthly", status: "active" })).toBe(
      5,
    );
    expect(
      firmSeatsForSubscription({ priceId: "attorney_solo_v2_monthly", status: "active" }),
    ).toBe(0);
  });
});

describe("optional follow-up cadence", () => {
  it("uses day 0, 2, 5, 9, 14 and stops after the fifth email", () => {
    expect(NURTURE_DAYS).toEqual([0, 2, 5, 9, 14]);
    expect(nextNurtureDate(1, "2026-09-19T00:00:00Z", Date.parse("2026-09-19T00:00:00Z"))).toBe(
      "2026-09-21T00:00:00.000Z",
    );
    expect(nextNurtureDate(5, "2026-09-19")).toBeNull();
  });
  it("does not blast overdue messages together when a worker resumes", () => {
    expect(nextNurtureDate(2, "2026-09-01T00:00:00Z", Date.parse("2026-09-19T00:00:00Z"))).toBe(
      "2026-09-22T00:00:00.000Z",
    );
  });
});

describe("public fictional resources", () => {
  it("builds readable PDFs without querying customer records", async () => {
    const kit = await PDFDocument.load(await buildAttorneyResource());
    const sample = await PDFDocument.load(await buildAttorneyResource(true));
    expect(kit.getPageCount()).toBe(4);
    expect(sample.getPageCount()).toBe(1);
    expect(sample.getTitle()).toMatch(/fictional/);
  });
});
