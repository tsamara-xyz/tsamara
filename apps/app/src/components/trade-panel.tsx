"use client";

import { type FormEvent, useCallback, useState } from "react";
import { api, subscribe, transfer, usd } from "@/lib/chain";
import { KycDialog } from "./kyc-dialog";
import { useStore } from "./store";
import { ConnectButtons } from "./ui";

/** The buy / send panel on an asset page. Walks an investor through the steps they still need. */
export function TradePanel() {
  const { series, wallet, position, busy, run } = useStore();
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

  return (
    <aside className="card trade">
      <div className="segmented">
        <button
          type="button"
          aria-pressed={tab === "buy"}
          className={tab === "buy" ? "on" : ""}
          onClick={() => setTab("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          aria-pressed={tab === "send"}
          className={tab === "send" ? "on" : ""}
          onClick={() => setTab("send")}
        >
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
              step={1}
              max={Math.max(room, 1)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(problem)}
              aria-describedby="units-hint"
            />
          </label>
          <p id="units-hint" className={`small ${problem ? "warn" : "muted"}`}>
            {problem || `Holding cap: ${cap} units per investor.`}
          </p>
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
              disabled={busy || Boolean(problem)}
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
      {verifying && <KycDialog onClose={closeKyc} />}
    </aside>
  );
}
