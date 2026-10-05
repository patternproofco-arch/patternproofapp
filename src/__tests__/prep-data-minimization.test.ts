import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NEVER_COLLECTED_FIELD_KEYS,
  SESSION_COUNTY_KEY,
  SAFETY_COPY_SHORT,
  SAFETY_COPY_STANDARD,
  QUIET_TAB_TITLE,
  PREP_VISIBILITY_PAUSE_MS,
  PREP_INACTIVITY_PURGE_MS,
} from "@/lib/prep/constants";
import {
  COUNSEL_WORKSHEET,
  FOUNDATION_SCRIPT_TEXT_MESSAGES,
  CLERK_QUESTIONS,
} from "@/lib/prep/evidentiary-copy";
import { STUDY_MODULES } from "@/lib/prep/modules-content";

const migration = readFileSync(
  join("supabase/migrations/20261005180000_study_profiles_and_lesson_progress.sql"),
  "utf8",
);

/** Strip SQL line comments before asserting schema shape. */
function sqlWithoutComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("prep data minimization (spec v5)", () => {
  it("migration never creates forbidden columns", () => {
    const body = sqlWithoutComments(migration).toLowerCase();
    for (const key of NEVER_COLLECTED_FIELD_KEYS) {
      expect(body).not.toMatch(new RegExp(`\\b${key}\\b\\s+(text|uuid|date|timestamptz|jsonb)`, "i"));
    }
    expect(body).toMatch(/study_profiles/);
    expect(body).toMatch(/user_lesson_progress/);
    expect(body).toMatch(/children_brackets/);
    expect(body).not.toMatch(/\bcounty\b/);
    expect(body).not.toMatch(/practice_answer/);
    expect(migration).toMatch(/muy only/);
  });

  it("session-only county keys are pp.prep.* sessionStorage, not localStorage writes", () => {
    expect(SESSION_COUNTY_KEY).toBe("pp.prep.county");
    const sessionSrc = readFileSync("src/lib/prep/session-county.ts", "utf8");
    expect(sessionSrc).toMatch(/sessionStorage/);
    expect(sessionSrc).not.toMatch(/localStorage\.setItem/);
    expect(sessionSrc).toMatch(/SESSION_COUNTY_KEY/);
  });

  it("progress marker stores only module_id and status", () => {
    const fn = readFileSync("src/lib/prep/study-profile.functions.ts", "utf8");
    expect(fn).toMatch(/module_id: data\.module_id/);
    expect(fn).toMatch(/status: data\.status/);
    // Upsert payload must not include practice narrative fields.
    expect(fn).not.toMatch(/practice_text:\s*data/);
    expect(fn).not.toMatch(/practice_answer:\s*/);
  });

  it("soft copy includes clerk questions and FLAG-01..04 in foundation script", () => {
    expect(CLERK_QUESTIONS.length).toBe(3);
    const joined = FOUNDATION_SCRIPT_TEXT_MESSAGES.paragraphs.join(" ");
    for (const f of ["FLAG-01", "FLAG-02", "FLAG-03", "FLAG-04"]) {
      expect(joined).toContain(`[${f}]`);
    }
  });

  it("counsel worksheet covers FLAG-01 through FLAG-10 and does not claim approved", () => {
    expect(COUNSEL_WORKSHEET.map((r) => r.id)).toEqual([
      "FLAG-01",
      "FLAG-02",
      "FLAG-03",
      "FLAG-04",
      "FLAG-05",
      "FLAG-06",
      "FLAG-07",
      "FLAG-08",
      "FLAG-09",
      "FLAG-10",
    ]);
    const guide = readFileSync("src/routes/_authenticated/prep.guide.tsx", "utf8");
    expect(guide).toMatch(/does not claim any flag is approved/i);
    expect(guide).not.toMatch(/counsel has approved/i);
  });

  it("coach prompt enforces UPL boundary and zero-persistence", () => {
    const coach = readFileSync("src/lib/prep/coach.functions.ts", "utf8");
    expect(coach).toMatch(/Unauthorized Practice of Law/i);
    expect(coach).toMatch(/never give tactical legal advice/i);
    expect(coach).toMatch(/never predict case outcomes/i);
    expect(coach).toMatch(/ephemeral|not saved/i);
    expect(coach).toMatch(/persisted: false/);
  });

  it("modules exist and never collect child names or dockets", () => {
    expect(STUDY_MODULES.length).toBeGreaterThanOrEqual(4);
    const blob = JSON.stringify(STUDY_MODULES).toLowerCase();
    // Positive collection prompts are banned; "do not enter children's names" is allowed.
    expect(blob).not.toMatch(/please enter .{0,40}child(ren)?['']?s? (full )?name/);
    expect(blob).not.toMatch(/enter your child/);
    expect(blob).not.toMatch(/docket number/);
    expect(blob).toMatch(/age bracket/);
  });
});

describe("prep route and header privacy", () => {
  it("security headers force no-store max-age=0 for /prep", () => {
    const src = readFileSync("src/lib/security-headers.ts", "utf8");
    expect(src).toMatch(/\/prep/);
    expect(src).toMatch(/no-store, max-age=0/);
  });

  it("service worker exempts /prep from cache", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toMatch(/isPrepPath/);
    expect(sw).toMatch(/\/prep\//);
    expect(sw).toMatch(/CACHE_VERSION = "v7/);
  });

  it("both safety copy versions and quiet-tab timing constants exist", () => {
    expect(SAFETY_COPY_STANDARD.length).toBeGreaterThan(80);
    expect(SAFETY_COPY_SHORT.length).toBeGreaterThan(40);
    expect(QUIET_TAB_TITLE).toBe("Local Daily Weather & Forecast");
    expect(PREP_VISIBILITY_PAUSE_MS).toBe(60_000);
    expect(PREP_INACTIVITY_PURGE_MS).toBe(5 * 60_000);
  });

  it("quiet weather favicon asset exists", () => {
    const svg = readFileSync("public/icons/weather-quiet.svg", "utf8");
    expect(svg).toMatch(/svg/i);
  });
});
