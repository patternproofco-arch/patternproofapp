import { describe, expect, it } from "vitest";
import { binderOutputBlockReason } from "../lib/binder-output-readiness";

describe("binder output completeness", () => {
  const complete = { data: { items: [] } };
  it("allows complete, empty successful reads", () => {
    expect(binderOutputBlockReason([complete, complete, complete], 0)).toBeNull();
  });
  for (let index = 0; index < 3; index++) {
    it(`blocks failed required read ${index}, even with cached data`, () => {
      const reads = [complete, complete, complete];
      reads[index] = { ...complete, error: new Error("read failed") } as typeof complete;
      expect(binderOutputBlockReason(reads, 0)).not.toBeNull();
    });
  }
  it.each(["isPending", "isLoading", "isFetching"])("blocks %s with cached data", (state) => {
    expect(binderOutputBlockReason([{ ...complete, [state]: true }], 0)).not.toBeNull();
  });
  it("blocks missing data and changed numbered records", () => {
    expect(binderOutputBlockReason([{}], 0)).not.toBeNull();
    expect(binderOutputBlockReason([complete], 1)).not.toBeNull();
  });
  it("allows output again only after successful recovery", () => {
    expect(binderOutputBlockReason([{ data: {}, error: new Error() }], 0)).not.toBeNull();
    expect(binderOutputBlockReason([complete], 0)).toBeNull();
  });
});
