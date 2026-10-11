import { type ChainEvent, explorer, short, usd } from "@/lib/chain";

export function describe(e: ChainEvent, decimals: number): string {
  if (e.kind === "approved") return "Investor approved";
  if (e.kind === "revoked") return "Investor revoked";
  const units = `${e.units} ${e.units === "1" ? "unit" : "units"}`;
  if (e.kind === "subscription") return `Subscribed ${units} for ${usd(e.amount, decimals)}`;
  if (e.kind === "distribution") return `Distribution of ${usd(e.amount, decimals)}`;
  return `Transferred ${units}`;
}

export function Activity({ events, decimals, empty }: { events: ChainEvent[]; decimals: number; empty: string }) {
  if (events.length === 0) return <p className="muted small">{empty}</p>;
  return (
    <table className="table compact">
      <thead>
        <tr>
          <th>Event</th>
          <th>Investor</th>
          <th className="num">Time</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr key={e.signature + e.kind + e.wallet}>
            <td>{describe(e, decimals)}</td>
            <td title={e.wallet}>{short(e.wallet)}</td>
            <td className="num">
              <a href={explorer(e.signature)} target="_blank" rel="noreferrer">
                {e.time ? new Date(e.time * 1000).toLocaleString() : "pending"} ↗
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
