<img src="apps/landing/public/android-chrome-192x192.png" alt="Tsamara logo" width="72" />

# Tsamara

Sovereign sukuk for everyone: buy from $10 in USDC, trade any time, receive distributions onchain.

> Devnet prototype built for the Colosseum Crypto World's Fair hackathon. The sukuk series is a mock; this is not a real issuance or an offer of securities.

## Why

Sukuk are the fixed-income instrument of Islamic finance: asset-backed certificates that pay a share of profit instead of interest. Sovereign dollar sukuk are sold to institutions in large minimum denominations and trade over the counter, so most investors who want a sharia-compliant, dollar-denominated, government-backed return cannot buy one directly.

Tsamara represents a sukuk series as a token with a small unit size. A KYC'd investor in any jurisdiction where the series is offered can hold a fraction, settle in stablecoins, and sell to another approved investor at any time.

## How it works

Rules are enforced onchain: by Solana's Token-2022 program, and by a small transfer hook program that Token-2022 calls on every transfer of the sukuk.

| Rule | Mechanism |
|---|---|
| Series terms (akad, maturity, currency, profit rate, unit size, restricted jurisdictions) are public | Token metadata stored on the mint |
| Only approved investors can hold the sukuk | Token accounts are frozen by default; the compliance authority thaws them |
| The issuer cannot decide who holds | Mint authority and freeze authority are separate keys |
| A recipient must be a registered investor in an allowed jurisdiction | Transfer hook checks the recipient's investor record on every transfer |
| No investor can receive more than the holding cap | Transfer hook checks the recipient's balance after the transfer |
| Subscription and trades cannot half-settle | Payment and delivery are two instructions in one transaction |
| Distributions are paid pro rata | Stablecoin transfers from the issuer treasury, computed from holdings |

The hook does not run when units are minted, so the holding cap is not enforced on primary subscriptions yet. The compliance program is unaudited.

The payment token is configurable (mint, decimals, token program). The demo uses a mock dollar token with the same token program and decimals as USDC.

## Repository layout

```
contracts            Anchor program: transfer hook, series rules, investor registry
packages/sukuk       Instruction builders: issuance, KYC, settlement, distribution
apps/devnet-demo     End-to-end lifecycle on devnet, also the integration check
apps/indexer         Rust indexer on the Carbon framework: holders and events in SQLite, served over HTTP
```

## Run it

Requires [Bun](https://bun.sh).

```sh
bun install
bun test          # unit tests
bun run demo      # full lifecycle on devnet, prints explorer links
```

The demo uses the compliance program deployed on devnet at `EjYxuJE4QE8P37scBxgWRHGigZ8hP6j3ysnSQ95MWXXG`. To build it yourself, install the Solana CLI and Anchor, then run `anchor build` in `contracts/`.

The first `bun run demo` prints an issuer address. Fund it with devnet SOL from https://faucet.solana.com and run again.

The indexer requires [Rust](https://rustup.rs) 1.91 or newer. It follows the series from the last `bun run demo`, or the one named by `SUKUK_MINT`, `PAYMENT_MINT` and `ISSUER`.

```sh
bun run indexer --once   # index what exists, print holders and the event count, exit
bun run indexer          # keep indexing and serve /series, /holders, /events on PORT (default 8787)
cargo test --manifest-path apps/indexer/Cargo.toml
```

It reads from `RPC` (default `https://api.devnet.solana.com`) and stores to `.data/indexer-<SUKUK_MINT>.db`. `GET /events?wallet=<address>` returns one wallet's history.

## Status

This is a prototype. It is not compliance-ready or production-ready, and it does not claim any regulatory approval or sharia certification. The gaps are tracked as issues labelled [`compliance`](https://github.com/tsamara-xyz/tsamara/labels/compliance) and [`production`](https://github.com/tsamara-xyz/tsamara/labels/production).

## License

MIT
