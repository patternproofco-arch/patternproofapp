#!/usr/bin/env node
// SEO regression check — static analysis of robots.txt, sitemap route, and
// every public page route's head() meta. Exits non-zero on any failure.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const errors = [];
const ok = [];
const fail = (msg) => errors.push(msg);
const pass = (msg) => ok.push(msg);

const isAbsolute = (u) => /^https?:\/\/[^\s/]+\/?/.test(u);

// ---------- robots.txt ----------
try {
  const robots = readFileSync("public/robots.txt", "utf8");
  const sitemapLine = robots.split("\n").find((l) => /^\s*Sitemap:/i.test(l));
  if (!sitemapLine) fail("robots.txt: missing `Sitemap:` directive");
  else {
    const url = sitemapLine.split(":").slice(1).join(":").trim();
    if (!isAbsolute(url)) fail(`robots.txt: Sitemap URL must be absolute (got "${url}")`);
    else pass(`robots.txt Sitemap: ${url}`);
  }
  if (!/^\s*User-agent:/im.test(robots)) fail("robots.txt: missing `User-agent:` block");
} catch (e) {
  fail(`robots.txt: ${e.message}`);
}

// ---------- sitemap.xml route ----------
try {
  const sm = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");
  const baseMatch = sm.match(/BASE_URL\s*=\s*["'`]([^"'`]*)["'`]/);
  if (!baseMatch) fail("sitemap: BASE_URL constant not found");
  else if (!isAbsolute(baseMatch[1]))
    fail(`sitemap: BASE_URL must be absolute (got "${baseMatch[1]}")`);
  else pass(`sitemap BASE_URL: ${baseMatch[1]}`);
} catch (e) {
  fail(`sitemap: ${e.message}`);
}

// ---------- per-route head() meta ----------
// Public, indexable pages we require to ship absolute canonical + og:url +
// twitter:title + twitter:description. Auth-gated and noindex routes are
// exempt from canonical (since they shouldn't be indexed).
const PAGE_ROUTES = [
  { file: "src/routes/index.tsx", path: "/", requireCanonical: true },
  { file: "src/routes/signin.tsx", path: "/signin", requireCanonical: true },
  { file: "src/routes/signup.tsx", path: "/signup", requireCanonical: true },
  // /login is a legacy redirect to /signin and deliberately renders no page head.
  { file: "src/routes/attorney.$token.tsx", path: "/attorney/$token", requireCanonical: false },
  { file: "src/routes/demo.tsx", path: "/demo", requireCanonical: true },
  { file: "src/routes/privacy.tsx", path: "/privacy", requireCanonical: true },
  { file: "src/routes/resources.tsx", path: "/resources", requireCanonical: true },
  { file: "src/routes/self-help-guide.tsx", path: "/self-help-guide", requireCanonical: true },
  { file: "src/routes/safety.tsx", path: "/safety", requireCanonical: true },
  {
    file: "src/routes/evidence-integrity.tsx",
    path: "/evidence-integrity",
    requireCanonical: true,
  },
  { file: "src/routes/ai-transparency.tsx", path: "/ai-transparency", requireCanonical: true },
  {
    file: "src/routes/professional-access.tsx",
    path: "/professional-access",
    requireCanonical: true,
  },
  { file: "src/routes/support.tsx", path: "/support", requireCanonical: true },
  {
    file: "src/routes/family-law-workload.tsx",
    path: "/family-law-workload",
    requireCanonical: true,
  },
];

const readQuoted = (src, startIdx) => {
  // Skip whitespace, read one of " ' or `, return [value, endIdx] or null.
  let i = startIdx;
  while (i < src.length && /\s/.test(src[i])) i++;
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let out = "";
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      out += src[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (c === q) return [out, i + 1];
    out += c;
    i++;
  }
  return null;
};

const getMeta = (src, key, kind = "property") => {
  const keyEsc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\{\\s*${kind}\\s*:\\s*["']${keyEsc}["']\\s*,\\s*content\\s*:`, "g");
  const m = re.exec(src);
  if (!m) return null;
  const r = readQuoted(src, m.index + m[0].length);
  return r ? r[0] : null;
};

const getCanonical = (src) => {
  const re = /rel\s*:\s*["']canonical["']\s*,\s*href\s*:/g;
  const m = re.exec(src);
  if (!m) return null;
  const r = readQuoted(src, m.index + m[0].length);
  return r ? r[0] : null;
};

for (const route of PAGE_ROUTES) {
  let src;
  try {
    src = readFileSync(route.file, "utf8");
  } catch (e) {
    fail(`${route.file}: ${e.message}`);
    continue;
  }
  const tag = `${route.path}`;

  // Required tags
  const checks = [
    { name: "og:url", value: getMeta(src, "og:url", "property"), mustBeAbsolute: true },
    { name: "og:title", value: getMeta(src, "og:title", "property"), mustBeAbsolute: false },
    {
      name: "og:description",
      value: getMeta(src, "og:description", "property"),
      mustBeAbsolute: false,
    },
    { name: "twitter:title", value: getMeta(src, "twitter:title", "name"), mustBeAbsolute: false },
    {
      name: "twitter:description",
      value: getMeta(src, "twitter:description", "name"),
      mustBeAbsolute: false,
    },
  ];

  for (const c of checks) {
    if (!c.value) {
      fail(`${tag}: missing ${c.name}`);
      continue;
    }
    if (c.mustBeAbsolute) {
      // Strip template placeholders before checking absoluteness.
      const resolved = c.value.replace(/\$\{[^}]+\}/g, "x");
      if (!isAbsolute(resolved)) {
        fail(`${tag}: ${c.name} must be absolute (got "${c.value}")`);
        continue;
      }
    }
    pass(`${tag} ${c.name}: ${c.value}`);
  }

  if (route.requireCanonical) {
    const canon = getCanonical(src);
    if (!canon) fail(`${tag}: missing <link rel="canonical">`);
    else if (!isAbsolute(canon.replace(/\$\{[^}]+\}/g, "x")))
      fail(`${tag}: canonical href must be absolute (got "${canon}")`);
    else pass(`${tag} canonical: ${canon}`);
  }
}

// ---------- report ----------
console.log(`SEO check — ${ok.length} pass, ${errors.length} fail`);
for (const o of ok) console.log("  ✓", o);
for (const e of errors) console.log("  ✗", e);

if (errors.length) {
  console.error(`\n${errors.length} SEO regression(s) detected.`);
  process.exit(1);
}
console.log("\nAll SEO checks passed.");
