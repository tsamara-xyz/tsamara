# Deployment

Four containers, one per service. Each has a Dockerfile and reads its configuration from the environment.

| Service | Dockerfile | Build context | Port | Public URL |
|---|---|---|---|---|
| Landing | `apps/landing/Dockerfile` | repository root | 80 | https://tsamara.xyz |
| App | `apps/app/Dockerfile` | repository root | 3000 | https://app.tsamara.xyz |
| API | `apps/api/Dockerfile` | repository root | 8788 | https://api.tsamara.xyz |
| Indexer | `apps/indexer/Dockerfile` | `apps/indexer` | 8787 | https://indexer.tsamara.xyz |

## Configuration

| Service | Variable | Meaning |
|---|---|---|
| App (build time) | `NEXT_PUBLIC_API`, `NEXT_PUBLIC_INDEXER` | Public URLs of the API and the indexer, compiled into the bundle |
| App (build time) | `NEXT_PUBLIC_RPC` | Optional Solana RPC endpoint; defaults to public devnet |
| API | `ISSUER_KEY`, `COMPLIANCE_KEY` | Operator keys as JSON byte arrays. Devnet keys only |
| API | `SUKUK_MINT`, `PAYMENT_MINT` | The live series to serve |
| API | `ADMIN_TOKEN` | Required by `/admin` routes |
| API | `INDEXER` | URL of the indexer, used for the holder list |
| API | `SUMSUB_TOKEN`, `SUMSUB_SECRET` | Optional sandbox credentials; without them the operator approves by hand |
| API, Indexer | `RPC` | Optional Solana RPC endpoint |
| Indexer | `SUKUK_MINT`, `PAYMENT_MINT`, `ISSUER` | The series to index |

The indexer keeps its SQLite database in `/srv/.data`. Without a volume it rebuilds the index from the chain on every start, which is fine at this size.

The series is created once by starting the API locally with funded devnet keys (`bun run api`); its addresses are written to `.keys/series.json`.
