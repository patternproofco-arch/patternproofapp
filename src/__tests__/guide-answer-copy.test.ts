import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cleanGuideAnswer,
  preferFeatureNames,
  stripGuideAnswerMarkdown,
} from "@/lib/guide-answer-copy";

describe("stripGuideAnswerMarkdown", () => {
  it("removes bold and italic markdown markers", () => {
    expect(stripGuideAnswerMarkdown("Use **Add a Mark** to log it.")).toBe(
      "Use Add a Mark to log it.",
    );
    expect(stripGuideAnswerMarkdown("Tap *Archive* when you are ready.")).toBe(
      "Tap Archive when you are ready.",
    );
  });

  it("strips escaped asterisks and stray leftover *", () => {
    expect(stripGuideAnswerMarkdown("No leftover \\* here.")).toBe("No leftover here.");
    expect(stripGuideAnswerMarkdown("Weird ** leftover")).toBe("Weird leftover");
  });

  it("turns markdown bullet asterisks into plain bullets", () => {
    expect(stripGuideAnswerMarkdown("* Open Archive\n* Add a Mark")).toBe(
      "• Open Archive\n• Add a Mark",
    );
  });
});

describe("preferFeatureNames", () => {
  it("replaces + / plus button wording with Add a Mark", () => {
    expect(preferFeatureNames("Tap the + button to start.")).toBe("Tap Add a Mark to start.");
    expect(preferFeatureNames("Use the plus button on the dashboard.")).toBe(
      "Use Add a Mark on the dashboard.",
    );
    expect(preferFeatureNames("Click the + near the top.")).toBe("Click Add a Mark near the top.");
  });
});

describe("cleanGuideAnswer", () => {
  it("applies both markdown strip and feature naming", () => {
    expect(cleanGuideAnswer("Tap the **+ button** to log an incident.")).toBe(
      "Tap Add a Mark to log an incident.",
    );
  });
});

describe("guideChat system prompt copy", () => {
  const guide = readFileSync("src/lib/guide-chat.functions.ts", "utf8");

  it("names Add a Mark and forbids + button / markdown asterisks", () => {
    expect(guide).toContain("Add a Mark");
    expect(guide).toMatch(/never ["']the \+ button/i);
    expect(guide).toContain("plain text only");
    expect(guide).toContain("Do not use asterisks");
    expect(guide).toContain("cleanGuideAnswer");
  });
});
