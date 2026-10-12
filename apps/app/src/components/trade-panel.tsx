"use client";

import { type FormEvent, useCallback, useState } from "react";
import { api, subscribe, transfer, usd } from "@/lib/chain";
import { KycDialog } from "./kyc-dialog";
import { useStore } from "./store";
import { AssetIcon, ConnectButtons } from "./ui";

/** The buy / send panel on an asset page. Walks an investor through the steps they still need. */
export function TradePanel() {
  const { series, wallet, position, busy, run, connect } = useStore();
  const [tab, setTab] = useState<"buy" | "send">("buy");
  const [amount, setAmount] = useState("10");
  const [verifying, setVerifying] = useState(false);
  const closeKyc = useCallback(() => setVerifying(false), []);
  if (!series) return null;
  const price = BigInt(series.terms.unitValue);
  // Whole units only: anything else counts as nothing entered, so it can never reach BigInt.
  const units = /^[1-9]\d*$/.test(amount.trim()) ? Number(amount) : 0;
  const cost = price * BigInt(units);
  const cap = Number(series.terms.maxHolding);
  const room = cap - Number(position?.units ?? 0n);
  const problem =
    units === 0
      ? "Enter a whole number of units."
      : units > room
        ? `The holding cap leaves room for ${room} more units.`
        : "";
  const address = wallet?.publicKey.toBase58() ?? "";

  const onSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (wallet)
      run("Transfer settled", () => transfer(wallet, series, String(data.get("to")).trim(), Number(data.get("units"))));
  };

  const symbol = series.terms.symbol;
  const decimals = series.paymentDecimals;

  return (
    <aside className="trade">
      <div className="trade-tabs">
        <button
          type="button"
          aria-pressed={tab === "buy"}
          className={tab === "buy" ? "on" : ""}
          onClick={() => setTab("buy")}
        >
          Buy {symbol}
        </button>
        <button
          type="button"
          aria-pressed={tab === "send"}
          className={tab === "send" ? "on" : ""}
          onClick={() => setTab("send")}
        >
          Send {symbol}
        </button>
      </div>

      <div className="trade-body">
        {tab === "buy" ? (
          <>
            <div className="swap">
              <label>
                <span>Receive</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  max={Math.max(room, 1)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={Boolean(problem)}
                  aria-describedby="units-hint"
                />
                <span className="token">
                  <AssetIcon symbol={symbol} size={22} /> {symbol}
                </span>
              </label>
              <div>
                <span>Pay</span>
                <output>{usd(cost, decimals).slice(1)}</output>
                <span className="token">
                  <span className="tile-icon">$</span> USD
                </span>
              </div>
            </div>
            <p id="units-hint" className={`small ${problem ? "warn" : "muted"}`}>
              {problem || `${usd(price, decimals)} per unit · holding cap ${cap} units per investor`}
            </p>

            {!wallet ? (
              <>
                <button type="button" className="btn primary wide" disabled={busy} onClick={() => connect("burner")}>
                  Connect test wallet
                </button>
                <button type="button" className="btn wide" disabled={busy} onClick={() => connect("phantom")}>
                  Connect Phantom
                </button>
              </>
            ) : position && position.dollars < cost ? (
              <button
                type="button"
                className="btn primary wide"
                disabled={busy}
                onClick={() => run("Test dollars received", async () => (await api.faucet(address)).signature)}
              >
                Get $1,000 test dollars
              </button>
            ) : position && !position.registered ? (
              <button
                type="button"
                className="btn primary wide"
                disabled={busy}
                onClick={() => (series.kyc === "sumsub" ? setVerifying(true) : undefined)}
              >
                {series.kyc === "sumsub" ? "Verify identity to continue" : "Awaiting operator approval"}
              </button>
            ) : (
              <button
                type="button"
                className="btn primary wide"
                disabled={busy || Boolean(problem)}
                onClick={() => wallet && run("Subscription settled", () => subscribe(wallet, units))}
              >
                Subscribe
              </button>
            )}

            {wallet && (
              <dl className="quote">
                <div>
                  <dt>Your test dollars</dt>
                  <dd>{position ? usd(position.dollars, decimals) : "…"}</dd>
                </div>
                <div>
                  <dt>Your units</dt>
                  <dd>{position ? String(position.units) : "…"}</dd>
                </div>
              </dl>
            )}
            <p className="muted small">
              {wallet && position && !position.registered
                ? "Your sukuk account stays frozen until you are a registered investor. "
                : ""}
              Payment and delivery settle in one transaction, signed by you and the issuer. This runs on devnet with
              test dollars that have no value; nothing here is an offer of securities.
            </p>
          </>
        ) : !wallet ? (
          <>
            <p className="muted">Connect a wallet to send units. Phantom must be set to devnet.</p>
            <ConnectButtons />
          </>
        ) : (
          <form onSubmit={onSend}>
            <label className="field">
              <span>Recipient address</span>
              <input name="to" required placeholder="Registered investor's address" />
            </label>
            <label className="field">
              <span>Units (you hold {position ? String(position.units) : "…"})</span>
              <input
                name="units"
                type="number"
                min={1}
                step={1}
                max={Number(position?.units ?? 1n) || 1}
                defaultValue={1}
                required
              />
            </label>
            <button type="submit" className="btn primary wide" disabled={busy}>
              Send
            </button>
            <p className="muted small">
              The chain rejects the transfer unless the recipient is registered and stays within the holding cap.
            </p>
          </form>
        )}
      </div>
      {verifying && <KycDialog onClose={closeKyc} />}
    </aside>
  );
}
