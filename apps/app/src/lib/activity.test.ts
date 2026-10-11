import { expect, test } from "bun:test";
import { investorCount, outstandingSeries, outstandingUnits } from "./activity";
import type { ChainEvent, Holder } from "./chain";

const event = (kind: ChainEvent["kind"], units: string, time: number): ChainEvent => ({
  signature: `sig-${time}`,
  time,
  kind,
  wallet: "w",
  counterparty: null,
  units,
  amount: "0",
});
const holders: Holder[] = [
  { wallet: "a", units: "60", approved: 1 },
  { wallet: "b", units: "40", approved: 1 },
  { wallet: "c", units: "0", approved: 1 },
];

test("outstanding series accumulates subscriptions in time order and ignores other events", () => {
  const events = [event("subscription", "40", 30), event("distribution", "0", 20), event("subscription", "60", 10)];
  expect(outstandingSeries(events)).toEqual([0, 60, 100]);
  expect(outstandingSeries([])).toEqual([0]);
});

test("outstanding units is the sum of all holdings", () => {
  expect(outstandingUnits(holders)).toBe(100n);
});

// Regression: an approved wallet with no units was counted as an investor.
test("investor count excludes approved wallets that hold nothing", () => {
  expect(investorCount(holders)).toBe(2);
});
