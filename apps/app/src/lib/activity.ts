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
