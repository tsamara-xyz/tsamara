"use client";

import "@/lib/buffer-polyfill";

// Shared app state. Server data (series, holders, events, position) lives in TanStack Query;
// this context adds the connected wallet, the notice bar, the search box and the action runner.
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "@/lib/chain";

// The indexer trails the chain by a few seconds, so poll rather than fetch once.
const POLL_MS = 15_000;
const CONNECTED = "tsamara-wallet";

export type Notice = { tone: "ok" | "error"; text: string; signature?: string } | null;

interface Position {
  registered: boolean;
  units: bigint;
  dollars: bigint;
}

interface Store {
  series: Series | null;
  /** The operator API cannot be reached; the series query keeps retrying. */
  offline: boolean;
  holders: Holder[];
  events: ChainEvent[];
  wallet: Wallet | null;
  position: Position | null;
  notice: Notice;
  busy: boolean;
  search: string;
  setSearch(value: string): void;
  connect(kind: Wallet["kind"]): Promise<void>;
  disconnect(): void;
  refresh(): Promise<void>;
  /** Runs one action at a time, reports its result in the notice bar, then refetches everything. */
  run(label: string, action: () => Promise<string | undefined>): Promise<void>;
  dismiss(): void;
}

const Context = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(Context);
  if (!store) throw new Error("useStore must be used inside <Providers>");
  return store;
}

function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const address = wallet?.publicKey.toBase58();

  // Keep asking while the API is down, so the page recovers on its own after a restart.
  const series = useQuery({
    queryKey: ["series"],
    queryFn: api.series,
    refetchInterval: (query) => (query.state.status === "error" ? 5_000 : false),
  });
  // The page still works when the indexer is offline: these simply stay empty.
  const holders = useQuery({ queryKey: ["holders"], queryFn: api.holders, refetchInterval: POLL_MS });
  const events = useQuery({ queryKey: ["events"], queryFn: () => api.events(), refetchInterval: POLL_MS });
  const position = useQuery({
    queryKey: ["position", address, series.data?.sukukMint],
    enabled: Boolean(wallet && series.data),
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<Position> => {
      if (!wallet || !series.data) throw new Error("wallet and series are required");
      const payment = {
        mint: new PublicKey(series.data.paymentMint),
        decimals: series.data.paymentDecimals,
        programId: TOKEN_PROGRAM_ID,
      };
      const [investor, dollars] = await Promise.all([
        api.investor(wallet.publicKey.toBase58()),
        dollarBalance(wallet.publicKey, payment),
      ]);
      return { registered: investor.registered, units: BigInt(investor.units), dollars };
    },
  });

  const refresh = useCallback(() => queryClient.invalidateQueries(), [queryClient]);

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
      localStorage.setItem(CONNECTED, kind);
    } catch (e) {
      setNotice({ tone: "error", text: explain(e) });
    }
  }, []);

  // A reload keeps the test wallet connected. Phantom is not reconnected: that would open its prompt unasked.
  useEffect(() => {
    if (localStorage.getItem(CONNECTED) === "burner") connect("burner");
  }, [connect]);

  const value = useMemo<Store>(
    () => ({
      series: series.data ?? null,
      offline: series.isError,
      holders: holders.data ?? [],
      events: events.data ?? [],
      wallet,
      position: position.data ?? null,
      notice,
      busy,
      search,
      setSearch,
      connect,
      disconnect: () => {
        localStorage.removeItem(CONNECTED);
        setWallet(null);
      },
      refresh,
      run,
      dismiss: () => setNotice(null),
    }),
    [
      series.data,
      series.isError,
      holders.data,
      events.data,
      wallet,
      position.data,
      notice,
      busy,
      search,
      connect,
      refresh,
      run,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>{children}</StoreProvider>
    </QueryClientProvider>
  );
}
