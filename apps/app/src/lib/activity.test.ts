import { expect, test } from "bun:test";
import { holdingHistory, inRange, investorCount, outstandingSeries, outstandingUnits } from "./activity";
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

test("holding history follows a wallet's subscriptions and transfers", () => {
  const events: ChainEvent[] = [
    { ...event("trade", "3", 30), wallet: "other", counterparty: "me" },
    { ...event("subscription", "10", 10), wallet: "me" },
    { ...event("trade", "2", 20), wallet: "me", counterparty: "other" },
    { ...event("distribution", "0", 25), wallet: "me" },
    { ...event("subscription", "50", 15), wallet: "someone-else" },
  ];
  expect(holdingHistory(events, "me")).toEqual([
    { time: 10, units: 10 },
    { time: 20, units: 12 },
    { time: 30, units: 9 },
  ]);
});

test("a range carries the opening balance in and the closing balance out", () => {
  const history = [
    { time: 100, units: 10 },
    { time: 900_000, units: 12 },
  ];
  const now = 1_000_000;
  expect(inRange(history, "1D", now)).toEqual([
    { time: now - 86_400, units: 12 },
    { time: now, units: 12 },
  ]);
  expect(inRange(history, "1W", now)).toEqual([
    { time: now - 604_800, units: 10 },
    { time: 900_000, units: 12 },
    { time: now, units: 12 },
  ]);
  expect(inRange(history, "ALL", now)[0]).toEqual({ time: 100, units: 0 });
  expect(inRange([], "1W", now).map((p) => p.units)).toEqual([0, 0]);
});
