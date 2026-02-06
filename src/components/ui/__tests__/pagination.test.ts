import { describe, it, expect } from "vitest";
import { getPageNumbers } from "../Pagination";

describe("getPageNumbers", () => {
  it("returns all pages when total <= 7", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns all pages when total is exactly 7", () => {
    expect(getPageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns [1, 2, ellipsis, 20] when current=1, total=20", () => {
    const result = getPageNumbers(1, 20);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result).toContain("ellipsis");
    expect(result[result.length - 1]).toBe(20);
  });

  it("returns first, ellipsis, middle range, ellipsis, last when in middle", () => {
    const result = getPageNumbers(10, 20);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe("ellipsis");
    expect(result).toContain(9);
    expect(result).toContain(10);
    expect(result).toContain(11);
    expect(result[result.length - 2]).toBe("ellipsis");
    expect(result[result.length - 1]).toBe(20);
  });

  it("returns [1, ellipsis, 19, 20] when current=20, total=20", () => {
    const result = getPageNumbers(20, 20);
    expect(result[0]).toBe(1);
    expect(result).toContain("ellipsis");
    expect(result).toContain(19);
    expect(result[result.length - 1]).toBe(20);
  });

  it("returns single page for total=1", () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
  });

  it("handles current=3 near start (no leading ellipsis)", () => {
    const result = getPageNumbers(3, 20);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result).toContain(3);
    expect(result).toContain(4);
  });

  it("handles current=18 near end (no trailing ellipsis)", () => {
    const result = getPageNumbers(18, 20);
    expect(result).toContain(17);
    expect(result).toContain(18);
    expect(result).toContain(19);
    expect(result[result.length - 1]).toBe(20);
  });
});
