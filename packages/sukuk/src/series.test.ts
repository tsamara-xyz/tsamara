import { expect, test } from "bun:test";
import { monthlyImbalan, termsToFields, type SeriesTerms } from "./series";

const terms: SeriesTerms = {
  name: "Sukuk Negara Ritel Demo 2029",
  symbol: "SRD29",
  akad: "Ijarah Asset to be Leased",
  maturity: "2029-10-10",
  imbalanBps: 625,
  unitRupiah: 10_000,
};

test("monthly imbalan is pro rata and rounds down", () => {
  expect(monthlyImbalan(60n, terms)).toBe(3125n);
  expect(monthlyImbalan(40n, terms)).toBe(2083n); // 2083.33 rounds down
  expect(monthlyImbalan(0n, terms)).toBe(0n);
});

test("terms are serialised as onchain metadata fields", () => {
  expect(Object.fromEntries(termsToFields(terms))).toEqual({
    akad: "Ijarah Asset to be Leased",
    maturity: "2029-10-10",
    imbalan_bps: "625",
    unit_idr: "10000",
  });
});
