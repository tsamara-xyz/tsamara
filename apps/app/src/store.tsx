// Shared app state: the live series, the connected wallet, indexed activity and the notice bar.
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  api,
  burnerWallet,
  type ChainEvent,
  connectPhantom,
  dollarBalance,
  explain,
  type Holder,
  type Series,
  type Wallet,
} from "./chain";

export type Notice = { tone: "ok" | "error"; text: string; signature?: string } | null;

interface Position {
  registered: boolean;
  units: bigint;
  dollars: bigint;
}

interface Store {
  series: Series | null;
  holders: Holder[];
  events: ChainEvent[];
  wallet: Wallet | null;
  position: Position | null;
  notice: Notice;
  busy: boolean;
  connect(kind: Wallet["kind"]): Promise<void>;
  refresh(): Promise<void>;
  /** Runs one action at a time, reports its result in the notice bar, then refreshes. */
  run(label: string, action: () => Promise<string | undefined>): Promise<void>;
  dismiss(): void;
}

const Context = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(Context);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [series, setSeries] = useState<Series | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    // The indexer may lag the chain by a few seconds or be offline; the page still works without it.
    api.holders().then(setHolders, () => setHolders([]));
    api.events().then(setEvents, () => setEvents([]));
    if (!wallet || !series) return setPosition(null);
    const address = wallet.publicKey.toBase58();
    const payment = {
      mint: new PublicKey(series.paymentMint),
      decimals: series.paymentDecimals,
      programId: TOKEN_PROGRAM_ID,
    };
    const [investor, dollars] = await Promise.all([api.investor(address), dollarBalance(wallet.publicKey, payment)]);
    setPosition({ registered: investor.registered, units: BigInt(investor.units), dollars });
  }, [wallet, series]);

  useEffect(() => {
    api.series().then(setSeries, (e) => setNotice({ tone: "error", text: explain(e) }));
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    const timer = setInterval(() => refresh().catch(() => {}), 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const run = useCallback<Store["run"]>(
    async (label, action) => {
      setBusy(true);
      setNotice(null);
      try {
        const signature = await action();
        setNotice({ tone: "ok", text: label, signature });
        await refresh();
      } catch (e) {
        setNotice({ tone: "error", text: explain(e) });
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const connect = useCallback<Store["connect"]>(async (kind) => {
    try {
      setWallet(kind === "burner" ? burnerWallet() : await connectPhantom());
    } catch (e) {
      setNotice({ tone: "error", text: explain(e) });
    }
  }, []);

  const value = useMemo<Store>(
    () => ({
      series,
      holders,
      events,
      wallet,
      position,
      notice,
      busy,
      connect,
      refresh,
      run,
      dismiss: () => setNotice(null),
    }),
    [series, holders, events, wallet, position, notice, busy, connect, refresh, run],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Units outstanding over time, from subscription events. Drives the charts. */
export function outstandingSeries(events: ChainEvent[]): number[] {
  const subscriptions = events.filter((e) => e.kind === "subscription").sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  let total = 0;
  return [0, ...subscriptions.map((e) => (total += Number(e.units)))];
}
