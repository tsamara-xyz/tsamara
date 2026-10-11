# Indexer. Build from apps/indexer: docker build apps/indexer
FROM rust:1.91-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY Cargo.toml Cargo.lock rustfmt.toml ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY --from=build /src/target/release/tsamara-indexer /usr/local/bin/tsamara-indexer
# SQLite lives in /srv/.data; mount a volume there to keep the index across restarts.
ENV PORT=8787
EXPOSE 8787
CMD ["tsamara-indexer"]
