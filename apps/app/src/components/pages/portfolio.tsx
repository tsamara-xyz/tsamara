"use client";

import Link from "next/link";
import { rate } from "@/lib/assets";
import { usd } from "@/lib/chain";
import { Activity } from "../activity-table";
import { useStore } from "../store";
import { AssetIcon, ConnectButtons } from "../ui";

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

export function PortfolioPage() {
  const { series, wallet, position, events } = useStore();
  if (!series) return <p className="muted pad">Loading series…</p>;
  if (!wallet) {
    return (
      <section className="card center">
        <h2>Your portfolio</h2>
        <p className="muted">Connect a wallet to see your holdings, distributions and history.</p>
        <ConnectButtons />
      </section>
    );
  }
  const address = wallet.publicKey.toBase58();
  const decimals = series.paymentDecimals;
  const mine = events.filter((e) => e.wallet === address || e.counterparty === address);
  const received = sum(
    mine.filter((e) => e.kind === "distribution" && e.wallet === address).map((e) => BigInt(e.amount)),
  );
  const units = position?.units ?? 0n;
  const value = units * BigInt(series.terms.unitValue);

  return (
    <>
      <section className="card strip">
        <div>
          <p className="label">Total Portfolio Value</p>
          <p className="big">{usd(value, decimals)}</p>
        </div>
        <dl className="mini">
          <div>
            <dt>Distributions received</dt>
            <dd>{usd(received, decimals)}</dd>
          </div>
          <div>
            <dt>Test dollars</dt>
            <dd>{usd(position?.dollars ?? 0n, decimals)}</dd>
          </div>
          <div>
            <dt>KYC</dt>
            <dd>{position?.registered ? "Approved" : "Not approved"}</dd>
          </div>
        </dl>
        <code className="muted small">{address}</code>
      </section>

      <section className="card list">
        <h3 className="pad">Holdings</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Asset Name</th>
              <th className="num">Units</th>
              <th className="num">Price</th>
              <th className="num">Value</th>
              <th className="num">Expected profit rate</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units > 0n ? (
              <tr>
                <td>
                  <span className="name">
                    <AssetIcon symbol={series.terms.symbol} />
                    <span>
                      <strong>{series.terms.symbol}</strong>
                      <small>{series.terms.name}</small>
                    </span>
                  </span>
                </td>
                <td className="num">{String(units)}</td>
                <td className="num">{usd(series.terms.unitValue, decimals)}</td>
                <td className="num">{usd(value, decimals)}</td>
                <td className="num up">{rate(series.terms.profitRateBps)}</td>
                <td className="num">
                  <Link className="btn small" href={`/assets/${series.terms.symbol.toLowerCase()}`}>
                    Trade
                  </Link>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={6} className="muted">
                  No holdings yet.{" "}
                  <Link href={`/assets/${series.terms.symbol.toLowerCase()}`}>Subscribe to {series.terms.symbol}</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>History</h3>
        <Activity events={mine} decimals={decimals} empty="Nothing yet." />
      </section>
    </>
  );
}
