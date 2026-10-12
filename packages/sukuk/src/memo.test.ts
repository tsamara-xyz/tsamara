import { expect, test } from "bun:test";
import { memoTexts } from "./memo";

test("memo texts are split by their length prefix, so one memo cannot pose as another", () => {
  expect(memoTexts("[36] tsamara:distribution:GSD31:2026-H2:1")).toEqual(["tsamara:distribution:GSD31:2026-H2:1"]);
  expect(memoTexts("[3] a;b; [1] c")).toEqual(["a;b", "c"]);
  // Batch 10 is not batch 1, and a memo quoting another memo is still one text.
  expect(memoTexts("[6] x:1:10")).not.toContain("x:1:1");
  expect(memoTexts("[14] [3] a; [1] zzz")).toEqual(["[3] a; [1] zzz"]);
  expect(memoTexts(null)).toEqual([]);
  expect(memoTexts("no prefix")).toEqual([]);
});
