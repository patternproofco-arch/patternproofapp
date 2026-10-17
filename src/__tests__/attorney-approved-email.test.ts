import { describe, expect, it } from "vitest";
import { attorneyApprovedEmail } from "@/lib/attorney-approved-email";

describe("attorneyApprovedEmail", () => {
  const mail = attorneyApprovedEmail("https://app.example.test/");

  it("tells the attorney what to do next without leaking any case detail", () => {
    expect(mail.subject).toMatch(/approved/i);
    expect(mail.text).toContain("https://app.example.test/setup");
    expect(mail.text).not.toMatch(/survivor|victim|abus|incident|evidence|case file/i);
    expect(mail.text).not.toMatch(/accept-invite|invite_token|token/i);
  });

  it("avoids a double slash when the origin ends with one", () => {
    expect(mail.text).not.toContain("test//setup");
  });
});
