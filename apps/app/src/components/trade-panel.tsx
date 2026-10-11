"use client";

import { type FormEvent, useState } from "react";
import { api, subscribe, transfer, usd } from "@/lib/chain";
import { KycDialog } from "./kyc-dialog";
import { useStore } from "./store";
import { ConnectButtons } from "./ui";

/** The buy / send panel on an asset page. Walks an investor through the steps they still need. */
export function TradePanel() {
  const { series, wallet, position, busy, run } = useStore();
  const [tab, setTab] = useState<"buy" | "send">("buy");
  const [units, setUnits] = useState(10);
  const [verifying, setVerifying] = useState(false);
  if (!series) return null;
  const price = BigInt(series.terms.unitValue);
  const cost = price * BigInt(Math.max(units, 0));
  const address = wallet?.publicKey.toBase58() ?? "";

  const onSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (wallet)
      run("Transfer settled", () => transfer(wallet, series, String(data.get("to")).trim(), Number(data.get("units"))));
  };

  return (
    <aside className="card trade">
      <div className="segmented">
        <button type="button" className={tab === "buy" ? "on" : ""} onClick={() => setTab("buy")}>
          Buy
        </button>
        <button type="button" className={tab === "send" ? "on" : ""} onClick={() => setTab("send")}>
          Send
        </button>
      </div>

      {!wallet ? (
        <>
          <p className="muted">Connect a wallet to invest. Phantom must be set to devnet.</p>
          <ConnectButtons />
        </>
      ) : tab === "buy" ? (
        <>
          <label className="field">
            <span>Units</span>
            <input
              type="number"
              min={1}
              max={Number(series.terms.maxHolding)}
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
          </label>
          <dl className="quote">
            <div>
              <dt>Price per unit</dt>
              <dd>{usd(price, series.paymentDecimals)}</dd>
            </div>
            <div>
              <dt>You pay</dt>
              <dd>{usd(cost, series.paymentDecimals)}</dd>
            </div>
            <div>
              <dt>Your test dollars</dt>
              <dd>{position ? usd(position.dollars, series.paymentDecimals) : "…"}</dd>
            </div>
          </dl>
          {position && position.dollars < cost ? (
            <button
              type="button"
              className="btn primary wide"
              disabled={busy}
              onClick={() => run("Test dollars received", async () => (await api.faucet(address)).signature)}
            >
              Get $1,000 test dollars
            </button>
          ) : position && !position.registered ? (
            <>
              <button
                type="button"
                className="btn primary wide"
                disabled={busy}
                onClick={() => (series.kyc === "sumsub" ? setVerifying(true) : undefined)}
              >
                {series.kyc === "sumsub" ? "Verify identity to continue" : "Awaiting operator approval"}
              </button>
              <p className="muted small">Your sukuk account stays frozen until you are a registered investor.</p>
            </>
          ) : (
            <button
              type="button"
              className="btn primary wide"
              disabled={busy || units < 1}
              onClick={() => wallet && run("Subscription settled", () => subscribe(wallet, units))}
            >
              Subscribe
            </button>
          )}
          <p className="muted small">Payment and delivery settle in one transaction, signed by you and the issuer.</p>
        </>
      ) : (
        <form onSubmit={onSend}>
          <label className="field">
            <span>Recipient address</span>
            <input name="to" required placeholder="Registered investor's address" />
          </label>
          <label className="field">
            <span>Units (you hold {position ? String(position.units) : "…"})</span>
            <input name="units" type="number" min={1} defaultValue={1} required />
          </label>
          <button type="submit" className="btn primary wide" disabled={busy}>
            Send
          </button>
          <p className="muted small">
            The chain rejects the transfer unless the recipient is registered and stays within the holding cap.
          </p>
        </form>
      )}
      {verifying && <KycDialog onClose={() => setVerifying(false)} />}
    </aside>
  );
}
