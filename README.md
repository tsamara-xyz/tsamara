<img src="apps/landing/public/android-chrome-192x192.png" alt="Tsamara logo" width="72" />

# Tsamara

Tokenized sovereign sukuk in $10 units: subscribe in stablecoins, transfer between approved investors, receive distributions onchain.

> Devnet prototype built for the Colosseum Crypto World's Fair hackathon. The sukuk series is a mock; this is not a real issuance or an offer of securities.

## Why

Sukuk are certificates of ownership in underlying assets: holders receive a share of what the assets earn, not interest on a loan. Sovereign dollar sukuk are sold to institutions in large minimum denominations and trade over the counter, so an investor who wants that exposure in small amounts cannot buy one directly.

Tsamara represents a sukuk series as a token with a small unit size. An approved investor in a jurisdiction where the series is offered can hold units, settle in stablecoins, and transfer them to another approved investor.

**What a real version would be.** Tsamara could not issue a sovereign sukuk; it could only hold one in a vehicle and issue units against it. Each unit would have to be a beneficial share in sukuk held on trust, with no affiliation to the sovereign issuer, and a first offering would be limited to eligible investors in one jurisdiction. The $10 unit and broad access are the design target, not something any regime permits an unlicensed issuer today. See [docs/REGULATION.md](docs/REGULATION.md).

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
apps/api             Operator API (Hono): co-signs subscriptions, approves investors, pays distributions
apps/app             Web app for app.tsamara.xyz (Next.js + TanStack Query and Table): explore, asset, portfolio, operator
apps/landing         Landing page for tsamara.xyz (Astro)
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

The operator API holds the issuer and compliance keys (devnet files under `.keys/`) and creates a live series on first start. It reads holders from the indexer, so run both.

```sh
bun run indexer                                   # terminal 1
ADMIN_TOKEN=change-me bun run api                 # terminal 2, serves on API_PORT (default 8788)
ADMIN_TOKEN=change-me bun apps/api/smoke.ts       # faucet -> KYC -> subscribe -> distribute, with assertions
```

Routes under `/admin` (KYC approval, distributions) require the `x-admin-token` header.

KYC runs through [Sumsub](https://sumsub.com) when `SUMSUB_TOKEN` and `SUMSUB_SECRET` (sandbox credentials) are set in `.env`; the API refuses non-sandbox tokens. Without them, the operator approves investors by hand.

With both running, start the web app:

```sh
bun run app        # http://localhost:3000
```

Use the built-in test wallet, or Phantom switched to devnet. Request test dollars, approve your address from the Operator tab with the admin token, then subscribe and transfer.

## Tests

| Layer | What it covers | Run |
|---|---|---|
| Program, unit (Rust) | Jurisdiction matching and account sizing | `cargo test --lib` in `contracts/` |
| Program, integration (LiteSVM) | The compiled program with the TypeScript library, in-process: who may initialize and register, transfers through the hook, the holding cap at its boundary | `bun test contracts` |
| Program, regression and security | The hook refuses to run outside a transfer, a forged recipient is rejected, revoked investors cannot move units, and the known minting gap is pinned | `bun test contracts` |
| Library, unit | Distribution math, settlement amounts and token programs, instruction encoding, eligibility | `bun test packages` |
| Indexer, unit (Rust) | Event classification and exactly-once storage | `cargo test --manifest-path apps/indexer/Cargo.toml` |
| App, unit and regression | Derived figures, error explanations, request shape (a past CORS bug) | `bun test apps/app` |
| End to end, devnet | Full lifecycle with assertions; API flow including Sumsub | `bun run demo`, `bun apps/api/smoke.ts` |

`bun test` runs every TypeScript suite and needs no network. The program tests load `contracts/tests/fixtures/tsamara_compliance.so`; run `bun run --cwd contracts build` after changing the program so they do not test a stale binary.

## Status

This is a prototype. It is not compliance-ready or production-ready, and it does not claim any regulatory approval or sharia certification. [docs/REGULATION.md](docs/REGULATION.md) sets out the legal and sharia position and what we must not claim. [docs/COMPLIANCE.md](docs/COMPLIANCE.md) maps each requirement to its control and honest status. The gaps are tracked as issues labelled [`compliance`](https://github.com/tsamara-xyz/tsamara/labels/compliance) and [`production`](https://github.com/tsamara-xyz/tsamara/labels/production).

## License

MIT
