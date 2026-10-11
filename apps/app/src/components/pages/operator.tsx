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
          <p className="muted small">Pays every holder pro rata from the issuer treasury in one transaction.</p>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => run("Distribution paid", async () => (await api.distribute(token)).signature)}
          >
            Pay all holders
          </button>
        </section>
      </div>

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
