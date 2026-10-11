# Tsamara

Tokenized sovereign sukuk on Solana for a global investor base: buy from $10 in USDC, trade any time, receive periodic distributions onchain.

Sovereign dollar sukuk are sold to institutions in large minimum denominations. Tsamara represents a series as a token with a small unit size, so a KYC'd investor anywhere can hold a fraction and settle in stablecoins.

> Devnet prototype built for the Colosseum Crypto World's Fair hackathon. The sukuk series is a mock; this is not a real issuance or an offer of securities.

## How it works

Every rule is enforced by Solana's Token-2022 program. There is no custom onchain program to audit.

| Rule | Mechanism |
|---|---|
| Series terms (akad, maturity, currency, profit rate, unit size) are public | Token metadata stored on the mint |
| Only KYC'd investors can hold the sukuk | Token accounts are frozen by default; the issuer thaws them |
| Subscription and trades cannot half-settle | Payment and delivery are two instructions in one transaction |
| Distributions are paid pro rata | Stablecoin transfers from the issuer treasury, computed from holdings |

## Repository layout

```
packages/sukuk       Instruction builders: issuance, KYC, settlement, distribution
apps/devnet-demo     End-to-end lifecycle on devnet, also the integration check
```

The payment token is configurable (mint, decimals, token program). The demo uses a mock dollar token with the same token program and decimals as USDC.

## Run it

Requires [Bun](https://bun.sh).

```sh
bun install
bun test          # unit tests
bun run demo      # full lifecycle on devnet, prints explorer links
```

The first `bun run demo` prints an issuer address. Fund it with devnet SOL from https://faucet.solana.com and run again.

## License

MIT
