import { expect, test } from "bun:test";
import { axisTop } from "./chart";

test("the axis tops out just above the maximum, on a round step", () => {
  expect(axisTop(2_300)).toBe(3_000);
  expect(axisTop(100)).toBe(125);
  expect(axisTop(0)).toBe(1);
  for (const max of [1, 7, 42, 999, 2_300_000_000]) expect(axisTop(max)).toBeGreaterThan(max);
});
