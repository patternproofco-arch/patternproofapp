import { describe, expect, it } from "vitest";
import { buildBinderEntries } from "@/lib/binder";
import {
  changeMarker,
  diffAgainstPackage,
  itemKey,
  labelExhibits,
  planNextPackage,
  withdrawnExhibits,
  type ExhibitPackage,
  type ItemRef,
} from "@/lib/exhibit-numbering";

const ref = (id: string, date: string | null, text = id, kind: ItemRef["kind"] = "incident"): ItemRef => ({
  key: itemKey(kind, id),
  kind,
  date,
  marker: changeMarker([id, date, text]),
});

describe("why numbering must be frozen", () => {
  it("today an earlier-dated entry silently renumbers everything after it", () => {
    const base = [
      { id: "a", date: "2026-02-01", title: "A" },
      { id: "b", date: "2026-03-01", title: "B" },
    ];
    const before = buildBinderEntries(base, [], []);
    const after = buildBinderEntries([...base, { id: "z", date: "2026-01-01", title: "Z" }], [], []);
    const num = (es: ReturnType<typeof buildBinderEntries>, id: string) => es.find((e) => e.id === id)!.exhibit;
    expect(num(before, "b")).toBe("Exhibit 2");
    expect(num(after, "b")).toBe("Exhibit 3"); // the old behavior: a cited number now means something else
  });

  it("with a package, the same addition leaves existing numbers alone", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01"), ref("b", "2026-03-01")], null);
    const pkg: ExhibitPackage = { version: v1.version, entries: v1.entries };
    const now = [ref("a", "2026-02-01"), ref("b", "2026-03-01"), ref("z", "2026-01-01")];
    const labels = labelExhibits(now, pkg);
    expect(labels.get("incident:a")!.label).toBe("Exhibit 1");
    expect(labels.get("incident:b")!.label).toBe("Exhibit 2");
    expect(labels.get("incident:z")!.label).toBe("Not yet numbered");
  });
});

describe("creating package versions", () => {
  it("v1 numbers by date, undated last, ties by key", () => {
    const v1 = planNextPackage(
      [ref("c", null), ref("b", "2026-03-01"), ref("a", "2026-03-01"), ref("d", "2026-01-15")],
      null,
    );
    expect(v1.version).toBe(1);
    expect(v1.entries.map((e) => [e.key, e.number])).toEqual([
      ["incident:d", 1],
      ["incident:a", 2],
      ["incident:b", 3],
      ["incident:c", 4],
    ]);
  });

  it("v2 keeps every existing number and numbers new items after the highest", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01"), ref("b", "2026-03-01")], null);
    const v2 = planNextPackage(
      [ref("a", "2026-02-01"), ref("b", "2026-03-01"), ref("z", "2026-01-01"), ref("y", "2026-04-01")],
      { version: 1, entries: v1.entries },
    );
    expect(v2.version).toBe(2);
    const n = Object.fromEntries(v2.entries.map((e) => [e.key, e.number]));
    expect(n).toEqual({ "incident:a": 1, "incident:b": 2, "incident:z": 3, "incident:y": 4 });
    expect(v2.diff.added.sort()).toEqual(["incident:y", "incident:z"]);
  });

  it("an item no longer shared keeps its number, and the number is never reused", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01"), ref("b", "2026-03-01")], null);
    // b is withdrawn; a new item arrives.
    const v2 = planNextPackage([ref("a", "2026-02-01"), ref("n", "2026-05-01")], {
      version: 1,
      entries: v1.entries,
    });
    const n = Object.fromEntries(v2.entries.map((e) => [e.key, e.number]));
    expect(n["incident:b"]).toBe(2); // still reserved
    expect(n["incident:n"]).toBe(3); // not 2
    expect(v2.diff.withdrawn).toEqual(["incident:b"]);
  });

  it("a withdrawn highest number is still never reused", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01"), ref("b", "2026-03-01")], null);
    const v2 = planNextPackage([ref("a", "2026-02-01"), ref("c", "2026-06-01")], { version: 1, entries: v1.entries });
    expect(v2.entries.find((e) => e.key === "incident:c")!.number).toBe(3);
  });

  it("planning does not mutate the previous package", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01")], null);
    const prev: ExhibitPackage = { version: 1, entries: v1.entries };
    const snapshot = JSON.stringify(prev);
    planNextPackage([ref("a", "2026-02-01", "edited"), ref("q", "2026-02-02")], prev);
    expect(JSON.stringify(prev)).toBe(snapshot);
  });

  it("a package holds no readable content, only keys, numbers and markers", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01", "private words here")], null);
    const text = JSON.stringify(v1);
    expect(text).not.toContain("private words here");
    expect(Object.keys(v1.entries[0]!).sort()).toEqual(["key", "kind", "marker", "number"]);
  });
});

describe("labels and change detection", () => {
  it("without a package, numbers are labelled provisional", () => {
    const labels = labelExhibits([ref("a", "2026-02-01"), ref("b", "2026-01-01")], null);
    expect(labels.get("incident:b")).toMatchObject({ label: "Provisional 1", status: "provisional", number: null });
    expect(labels.get("incident:a")!.label).toBe("Provisional 2");
  });

  it("flags an item that changed after the package was made", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01", "original")], null);
    const pkg: ExhibitPackage = { version: 1, entries: v1.entries };
    const edited = [ref("a", "2026-02-01", "edited by the survivor")];
    expect(labelExhibits(edited, pkg).get("incident:a")!.changedSinceVersion).toBe(true);
    expect(diffAgainstPackage(edited, pkg).changed).toEqual(["incident:a"]);
    expect(labelExhibits([ref("a", "2026-02-01", "original")], pkg).get("incident:a")!.changedSinceVersion).toBe(false);
  });

  it("an edit keeps its exhibit number", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01", "original")], null);
    const pkg: ExhibitPackage = { version: 1, entries: v1.entries };
    expect(labelExhibits([ref("a", "2026-02-01", "edited")], pkg).get("incident:a")!.label).toBe("Exhibit 1");
  });

  it("lists withdrawn exhibits so a citation never points at something else", () => {
    const v1 = planNextPackage([ref("a", "2026-02-01"), ref("b", "2026-03-01")], null);
    expect(withdrawnExhibits([ref("a", "2026-02-01")], { version: 1, entries: v1.entries })).toEqual([
      { key: "incident:b", number: 2 },
    ]);
    expect(withdrawnExhibits([ref("a", "2026-02-01")], null)).toEqual([]);
  });

  it("markers are stable for equal input and differ for any change", () => {
    expect(changeMarker(["a", "b", null])).toBe(changeMarker(["a", "b", null]));
    expect(changeMarker(["a", "b"])).not.toBe(changeMarker(["a", "c"]));
    expect(changeMarker(["ab", "c"])).not.toBe(changeMarker(["a", "bc"]));
  });
});

describe("the binder uses the frozen numbers when it is given them", () => {
  it("an earlier-dated addition no longer shifts any printed exhibit number", () => {
    const base = [
      { id: "a", date: "2026-02-01", title: "A" },
      { id: "b", date: "2026-03-01", title: "B" },
    ];
    const v1 = planNextPackage(
      base.map((b) => ref(b.id, b.date)),
      null,
    );
    const pkg: ExhibitPackage = { version: 1, entries: v1.entries };
    const now = [...base, { id: "z", date: "2026-01-01", title: "Z" }];
    const labels = new Map(
      [...labelExhibits(now.map((n) => ref(n.id, n.date)), pkg)].map(([k, v]) => [k, v.label]),
    );
    const entries = buildBinderEntries(now, [], [], labels);
    const num = (id: string) => entries.find((e) => e.id === id)!.exhibit;
    expect(num("a")).toBe("Exhibit 1");
    expect(num("b")).toBe("Exhibit 2");
    expect(num("z")).toBe("Not yet numbered");
    // Still listed in date order; only the printed number is stable.
    expect(entries.map((e) => e.id)).toEqual(["z", "a", "b"]);
  });

  it("an item missing from the labels never receives a number that belongs to someone else", () => {
    const entries = buildBinderEntries([{ id: "q", date: "2026-01-01", title: "Q" }], [], [], new Map());
    expect(entries[0]!.exhibit).toBe("Not yet numbered");
  });
});
