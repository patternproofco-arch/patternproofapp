import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("fonts are self-hosted (no Google Fonts requests)", () => {
  it("root head links /fonts/fonts.css and nothing on fonts.googleapis.com / fonts.gstatic.com", () => {
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    expect(root).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(root).toContain('href: "/fonts/fonts.css"');
  });

  it("every @font-face src in public/fonts/fonts.css exists and uses swap", () => {
    const cssUrl = new URL("../../public/fonts/fonts.css", import.meta.url);
    const css = readFileSync(cssUrl, "utf8");
    const srcs = [...css.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map((m) => m[1]);
    expect(srcs.length).toBe(10);
    for (const s of srcs)
      expect(existsSync(new URL(`../../public${s}`, import.meta.url))).toBe(true);
    const faces = css.match(/@font-face/g) ?? [];
    expect((css.match(/font-display: swap/g) ?? []).length).toBe(faces.length);
    for (const fam of ["Newsreader", "Source Sans 3", "IBM Plex Mono"])
      expect(css).toContain(`"${fam}"`);
  });
});
