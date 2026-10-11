import { expect, test } from "bun:test";
import { type Applicant, jurisdictionOf, verdictOf } from "./kyc";

const reviewed = (reviewAnswer: string, extra: Partial<Applicant> = {}): Applicant => ({
  id: "a",
  review: { reviewStatus: "completed", reviewResult: { reviewAnswer, rejectLabels: ["FORGERY"] } },
  ...extra,
});

test("the country is converted to alpha-2, preferring verified data over what the applicant typed", () => {
  expect(jurisdictionOf({ id: "a", fixedInfo: { country: "DEU" } })).toBe("DE");
  expect(jurisdictionOf({ id: "a", info: { idDocs: [{ country: "ARE" }] }, fixedInfo: { country: "DEU" } })).toBe("AE");
  expect(jurisdictionOf({ id: "a", info: { country: "USA", idDocs: [{ country: "ARE" }] } })).toBe("US");
  expect(jurisdictionOf({ id: "a" })).toBeUndefined();
  expect(jurisdictionOf({ id: "a", fixedInfo: { country: "XXX" } })).toBeUndefined();
});

test("an unfinished review is pending, whatever else is on record", () => {
  expect(verdictOf({ id: "a" })).toEqual({ status: "pending" });
  expect(verdictOf({ id: "a", review: { reviewStatus: "pending", reviewResult: { reviewAnswer: "GREEN" } } })).toEqual({
    status: "pending",
  });
});

test("only GREEN approves", () => {
  expect(verdictOf(reviewed("GREEN", { fixedInfo: { country: "DEU" } }))).toEqual({
    status: "approved",
    jurisdiction: "DE",
  });
  expect(verdictOf(reviewed("RED"))).toEqual({ status: "rejected", reason: "FORGERY" });
  expect(verdictOf(reviewed("YELLOW"))).toEqual({ status: "rejected", reason: "FORGERY" });
});
