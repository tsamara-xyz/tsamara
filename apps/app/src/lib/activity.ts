// Figures derived from indexed data. Pure, so they are unit-tested.
import type { ChainEvent, Holder } from "./chain";

/** Units outstanding over time, from subscription events. Drives the charts. */
export function outstandingSeries(events: ChainEvent[]): number[] {
  const subscriptions = events.filter((e) => e.kind === "subscription").sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  let total = 0;
  return [0, ...subscriptions.map((e) => (total += Number(e.units)))];
}

export const outstandingUnits = (holders: Holder[]): bigint => holders.reduce((sum, h) => sum + BigInt(h.units), 0n);

/** Wallets that hold units. An approved wallet with a zero balance is not an investor yet. */
export const investorCount = (holders: Holder[]): number => holders.filter((h) => BigInt(h.units) > 0n).length;

export interface HoldingPoint {
  /** Unix seconds. */
  time: number;
  units: number;
}

/** Units a wallet held after each of its subscriptions and transfers, oldest first. */
export function holdingHistory(events: ChainEvent[], wallet: string): HoldingPoint[] {
  let units = 0;
  return events
    .filter((e) => e.time !== null && (e.kind === "subscription" || e.kind === "trade"))
    .filter((e) => e.wallet === wallet || e.counterparty === wallet)
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    .map((e) => {
      // In a trade the event's wallet received the units and its counterparty sent them.
      units += e.wallet === wallet ? Number(e.units) : -Number(e.units);
      return { time: e.time ?? 0, units };
    });
}

export const RANGES = {
  "1D": 86_400,
  "1W": 604_800,
  "1M": 2_592_000,
  "3M": 7_776_000,
  "1Y": 31_536_000,
  ALL: Infinity,
} as const;
export type Range = keyof typeof RANGES;

/** The history clipped to a window ending now, carrying the opening balance in and the closing balance out. */
export function inRange(history: HoldingPoint[], range: Range, now: number): HoldingPoint[] {
  const start = RANGES[range] === Infinity ? (history[0]?.time ?? now) : now - RANGES[range];
  const opening = history.filter((p) => p.time < start).at(-1)?.units ?? 0;
  const inside = history.filter((p) => p.time >= start);
  const closing = inside.at(-1)?.units ?? opening;
  return [{ time: start, units: opening }, ...inside, { time: now, units: closing }];
}
