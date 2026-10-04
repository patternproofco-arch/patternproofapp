import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every text field needs a name a screen reader can announce (a <label> tied to it, aria-label,
 * or aria-labelledby). A placeholder alone disappears when typing and is not a reliable name.
 *
 * Many older screens were written without them. This counts the fields that still have none and
 * fails if the number goes UP, so the gap can only shrink. When you fix some, lower the number.
 */
const REMAINING_UNNAMED_FIELDS = 89;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function unnamed(file: string): number {
  const s = readFileSync(file, "utf8");
  let n = 0;
  const re = /<(input|textarea|select)\b((?:[^<>]|\{[^}]*\})*?)\/?>/gs;
  for (const m of s.matchAll(re)) {
    const attrs = m[2] ?? "";
    if (/type=["'](hidden|file|checkbox|radio)["']/.test(attrs)) continue;
    if (/\b(id=|aria-label=|aria-labelledby=)/.test(attrs) || attrs.includes("{...")) continue;
    const before = s.slice(0, m.index);
    if (before.lastIndexOf("<label") > before.lastIndexOf("</label>")) continue;
    n++;
  }
  return n;
}

describe("form fields have accessible names", () => {
  const root = new URL("../", import.meta.url).pathname;
  const files = [...walk(join(root, "routes")), ...walk(join(root, "components"))];

  it("the number of unnamed fields does not grow", () => {
    const total = files.reduce((sum, f) => sum + unnamed(f), 0);
    expect(total).toBeLessThanOrEqual(REMAINING_UNNAMED_FIELDS);
  });

  it("the sign-in and sign-up forms are fully named and hint to password managers", () => {
    for (const f of ["components/auth/AuthPage.tsx", "routes/accept-invite.$token.tsx", "routes/lawyer-signup.tsx", "routes/org-signup.tsx"]) {
      expect(unnamed(join(root, f))).toBe(0);
    }
    expect(readFileSync(join(root, "routes/lawyer-signup.tsx"), "utf8")).toMatch(/new-password/);
    expect(readFileSync(join(root, "routes/accept-invite.$token.tsx"), "utf8")).toMatch(/new-password/);
  });
});

describe("keyboard users can skip the navigation", () => {
  const root = new URL("../", import.meta.url).pathname;
  for (const [file, label] of [
    ["components/AppShell.tsx", "survivor app"],
    ["routes/_attorney.tsx", "attorney portal"],
    ["routes/_advocate.tsx", "advocate portal"],
  ] as const) {
    it(`the ${label} has a skip link and a main target`, () => {
      const src = readFileSync(join(root, file), "utf8");
      expect(src).toMatch(/href="#main-content" className="skip-link"/);
      expect(src).toMatch(/id="main-content"/);
    });
  }
});
