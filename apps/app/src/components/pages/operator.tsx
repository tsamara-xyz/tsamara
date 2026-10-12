"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/chain";
import { useStore } from "../store";

export function OperatorPage() {
  const { series, holders, busy, run } = useStore();
  const [token, setToken] = useState("");
  // Read after mount: sessionStorage does not exist while the page is rendered on the server.
  useEffect(() => setToken(sessionStorage.getItem("tsamara-admin") ?? ""), []);
  const saveToken = (value: string) => {
    setToken(value);
    sessionStorage.setItem("tsamara-admin", value);
  };
  const field = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? "").trim();

  return (
    <>
      <section className="card">
        <h2>Operator</h2>
        <p className="muted">
          Compliance and issuer actions are signed by the operator API and require its admin token.
        </p>
        <label className="field">
          <span>Admin token</span>
          <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} />
        </label>
      </section>

      <div className="two">
        <section className="card">
          <h3>{series?.kyc === "sumsub" ? "Sandbox: complete a Sumsub review" : "Approve an investor"}</h3>
          {series?.kyc === "sumsub" ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const wallet = field(e.currentTarget, "wallet");
                run(
                  "Review marked approved; the investor can now finish verification",
                  async () => void (await api.sandboxReview(token, wallet)),
                );
              }}
            >
              <input name="wallet" placeholder="Investor address" required aria-label="Investor address" />
              <button type="submit" className="btn primary" disabled={busy}>
                Mark approved
              </button>
              <p className="muted small">
                Stands in for Sumsub's reviewer in the sandbox. The onchain approval still happens only after the API
                reads the verdict.
              </p>
            </form>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                run(
                  "Investor approved",
                  async () => (await api.kyc(token, field(form, "wallet"), field(form, "jurisdiction"))).signature,
                );
              }}
            >
              <input name="wallet" placeholder="Investor address" required aria-label="Investor address" />
              <input
                name="jurisdiction"
                placeholder="Country (e.g. AE)"
                maxLength={2}
                required
                aria-label="Country code"
                className="narrow"
              />
              <button type="submit" className="btn primary" disabled={busy}>
                Approve
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h3>Pay the periodic distribution</h3>
          <p className="muted small">
            Pays every holder pro rata from the issuer treasury. Each batch is marked onchain with the period, so paying
            the same period again skips what is already paid.
          </p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const period = field(e.currentTarget, "period");
              run(`Distribution for ${period} paid; batches already paid were skipped`, async () => {
                const { batches } = await api.distribute(token, period);
                return batches.find((b) => b.signature)?.signature ?? undefined;
              });
            }}
          >
            <input
              name="period"
              placeholder="Period (e.g. 2026-H2)"
              pattern="[A-Za-z0-9\-]{1,16}"
              required
              aria-label="Period"
            />
            <button type="submit" className="btn primary" disabled={busy}>
              Pay all holders
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <h3>Forced transfer</h3>
        <p className="muted small">
          Moves units without the holder's signature, for lost keys, inheritance, or an order from a court or regulator.
          The reason and the ordering authority are written onchain with the transfer, and the recipient must still be a
          registered investor within the holding cap.
        </p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const order = {
              from: field(form, "from"),
              to: field(form, "to"),
              units: Number(field(form, "units")),
              reason: field(form, "reason"),
              orderedBy: field(form, "orderedBy"),
            };
            run("Forced transfer recorded", async () => (await api.forcedTransfer(token, order)).signature);
          }}
        >
          <input name="from" placeholder="From address" required aria-label="From address" />
          <input name="to" placeholder="To address" required aria-label="To address" />
          <input name="units" type="number" min={1} defaultValue={1} required aria-label="Units" className="narrow" />
          <select name="reason" required aria-label="Reason" defaultValue="lost-key">
            <option value="lost-key">Lost key</option>
            <option value="inheritance">Inheritance</option>
            <option value="court-order">Court order</option>
            <option value="regulator-order">Regulator order</option>
          </select>
          <input name="orderedBy" placeholder="Ordered by (authority and reference)" required aria-label="Ordered by" />
          <button type="submit" className="btn" disabled={busy}>
            Transfer
          </button>
        </form>
      </section>

      <section className="card list">
        <h3 className="pad">Holders</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Investor</th>
              <th className="num">Units</th>
              <th>KYC</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((h) => (
              <tr key={h.wallet}>
                <td>
                  <code>{h.wallet}</code>
                </td>
                <td className="num">{h.units}</td>
                <td>{h.approved ? "Approved" : "Frozen"}</td>
              </tr>
            ))}
            {holders.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No holders yet, or the indexer is not running.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
