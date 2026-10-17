import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import React from "react";
import { template } from "@/lib/email-templates/advocate-survivor-invitation";

describe("advocate → survivor invite email never reveals the org", () => {
  const data = { advocateName: "Jordan Lee", orgName: "Harbor DV Services", survivorName: "Alex" };
  it("subject, preview and body omit org name", async () => {
    const subject = template.subject(data as Record<string, unknown>);
    expect(subject).not.toMatch(/Harbor|DV/);
    const html = await render(React.createElement(template.component as any, data));
    expect(html).not.toMatch(/Harbor DV Services/);
    expect(html).not.toMatch(/\bDV\b/);
    expect(html).toMatch(/Jordan Lee/);
  });
  it("callers do not pass orgName", async () => {
    const fs = await import("node:fs");
    for (const f of [
      "src/lib/advocate-survivor-invites.functions.ts",
      "src/lib/email/invitation-email.functions.ts",
    ])
      expect(fs.readFileSync(f, "utf8")).not.toMatch(/orgName:/);
  });
});
