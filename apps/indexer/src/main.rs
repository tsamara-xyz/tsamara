//! Indexes one sukuk series into SQLite with a Carbon pipeline and serves it over HTTP.
//! Run from the repo root: bun run indexer            (index and serve)
//!                         bun run indexer --once     (index once, print holders, exit)

mod api;
mod classify;
mod store;

use carbon_core::{
    collection::InstructionDecoderCollection,
    error::{CarbonResult, Error as CarbonError},
    pipeline::Pipeline,
    processor::Processor,
    transaction::TransactionProcessorInputType,
};
use carbon_rpc_transaction_crawler_datasource::{ConnectionConfig, Filters, RetryConfig, RpcTransactionCrawler};
use classify::{Config, TokenBalance, Tx};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_client::GetConfirmedSignaturesForAddress2Config};
use solana_commitment_config::CommitmentConfig;
use solana_pubkey::Pubkey;
use solana_signature::Signature;
use solana_transaction_status::TransactionTokenBalance;
use std::{
    error::Error,
    str::FromStr,
    sync::{Arc, Mutex},
    time::Duration,
};

pub type Db = Arc<Mutex<rusqlite::Connection>>;

const TOKEN_PROGRAM: Pubkey = Pubkey::from_str_const("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM: Pubkey = Pubkey::from_str_const("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA_PROGRAM: Pubkey = Pubkey::from_str_const("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/// The two token instructions the classifier looks for; both token programs encode them the same way.
#[derive(Clone, Debug, PartialEq, Eq, Hash, serde::Serialize)]
enum TokenIx {
    FreezeAccount,
    ThawAccount,
}

impl InstructionDecoderCollection for TokenIx {
    type InstructionType = Self;

    fn parse_instruction(ix: &solana_instruction::Instruction) -> Option<Self> {
        if ix.program_id != TOKEN_PROGRAM && ix.program_id != TOKEN_2022_PROGRAM {
            return None;
        }
        match ix.data.first() {
            Some(10) => Some(Self::FreezeAccount),
            Some(11) => Some(Self::ThawAccount),
            _ => None,
        }
    }

    fn get_type(&self) -> Self {
        self.clone()
    }
}

/// Carbon processor: classifies each transaction and stores it.
struct Indexer {
    cfg: Config,
    db: Db,
}

impl Processor<TransactionProcessorInputType<'_, TokenIx>> for Indexer {
    async fn process(&mut self, data: &TransactionProcessorInputType<'_, TokenIx>) -> CarbonResult<()> {
        let balances = |b: &Option<Vec<TransactionTokenBalance>>| {
            b.iter()
                .flatten()
                .map(|b| TokenBalance {
                    mint: b.mint.clone(),
                    owner: b.owner.clone(),
                    amount: b.ui_token_amount.amount.parse().unwrap_or(0),
                })
                .collect()
        };
        let meta = data.metadata;
        let tx = Tx {
            signature: meta.signature.to_string(),
            slot: meta.slot,
            block_time: meta.block_time,
            pre: balances(&meta.meta.pre_token_balances),
            post: balances(&meta.meta.post_token_balances),
            instruction_types: data
                .instructions
                .iter()
                .map(|(_, ix)| match ix {
                    TokenIx::FreezeAccount => "freezeAccount",
                    TokenIx::ThawAccount => "thawAccount",
                })
                .collect(),
        };
        store::apply(&mut self.db.lock().unwrap(), &tx, &self.cfg).map_err(|e| CarbonError::Custom(e.to_string()))
    }
}

fn config() -> Result<Config, String> {
    let last_run: serde_json::Value = std::fs::read_to_string(".keys/last-run.json")
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    let get = |env: &str, key: &str| {
        let value = std::env::var(env)
            .ok()
            .or_else(|| last_run[key].as_str().map(String::from));
        let value = value.ok_or(format!(
            "{env} is not set and .keys/last-run.json has no {key}: set SUKUK_MINT, PAYMENT_MINT and ISSUER, or run `bun run demo` first"
        ))?;
        Pubkey::from_str(&value).map_err(|e| format!("{env} is not a valid address ({value}): {e}"))?;
        Ok::<_, String>(value)
    };
    Ok(Config {
        sukuk_mint: get("SUKUK_MINT", "sukukMint")?,
        payment_mint: get("PAYMENT_MINT", "paymentMint")?,
        issuer: get("ISSUER", "issuer")?,
    })
}

/// Successful signatures for `address` newer than `until`, newest first, plus the newest signature of any status.
async fn signatures_since(
    rpc: &RpcClient,
    address: &Pubkey,
    until: Option<Signature>,
) -> (Vec<String>, Option<String>) {
    let (mut ok, mut newest, mut before) = (Vec::new(), None, None);
    loop {
        let config = GetConfirmedSignaturesForAddress2Config {
            before,
            until,
            limit: Some(1000),
            commitment: None,
        };
        let page = match rpc.get_signatures_for_address_with_config(address, config).await {
            Ok(page) => page,
            Err(e) => {
                // The public endpoint rate-limits; keep trying rather than index a partial history.
                eprintln!("getSignaturesForAddress failed, retrying in 5s: {e}");
                tokio::time::sleep(Duration::from_secs(5)).await;
                continue;
            }
        };
        newest = newest.or(page.first().map(|s| s.signature.clone()));
        before = page.last().and_then(|s| Signature::from_str(&s.signature).ok());
        let full = page.len() == 1000;
        ok.extend(page.into_iter().filter(|s| s.err.is_none()).map(|s| s.signature));
        if !full {
            return (ok, newest);
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn")).init();
    let env = |key: &str, default: &str| std::env::var(key).unwrap_or(default.into());
    let cfg = config()?;
    let rpc_url = env("RPC", "https://api.devnet.solana.com");
    let rpc = RpcClient::new_with_commitment(rpc_url.clone(), CommitmentConfig::confirmed());

    std::fs::create_dir_all(".data")?;
    let db: Db = Arc::new(Mutex::new(store::open(&format!(
        ".data/indexer-{}.db",
        cfg.sukuk_mint
    ))?));

    // Every sukuk action references the mint; distributions only touch the treasury's payment account.
    // ponytail: assumes the payment token is on the legacy token program (USDC); read the mint's owner if that changes.
    let (mint, payment, issuer) = (
        cfg.sukuk_mint.parse()?,
        cfg.payment_mint.parse::<Pubkey>()?,
        cfg.issuer.parse::<Pubkey>()?,
    );
    let treasury = Pubkey::find_program_address(
        &[issuer.as_ref(), TOKEN_PROGRAM.as_ref(), payment.as_ref()],
        &ATA_PROGRAM,
    )
    .0;

    let mut pipeline = Pipeline::builder().transaction::<TokenIx, _>(Indexer {
        cfg: cfg.clone(),
        db: db.clone(),
    });
    let mut backlog = Vec::new();
    for address in [mint, treasury] {
        let cursor = store::cursor(&db.lock().unwrap(), &address.to_string())?;
        let until = cursor.map(|s| Signature::from_str(&s)).transpose()?;
        // Carbon's crawler does not say when it has caught up, so list what is pending now and wait for exactly that.
        let (pending, newest) = signatures_since(&rpc, &address, until).await;
        backlog.push((address.to_string(), pending, newest));
        // The crawler drops a transaction once its retries run out, so it never runs out; the public RPC answers
        // 429 often, hence two requests at a time and a backoff of up to 30s.
        let connection = ConnectionConfig::new(
            1000,
            Duration::from_millis(env("POLL_MS", "5000").parse()?),
            2,
            RetryConfig::new(u32::MAX, 1000, 30_000, 2.0),
            None,
            None,
            true, // wait for room in the pipeline instead of dropping the update
        );
        pipeline = pipeline.datasource(RpcTransactionCrawler::new(
            rpc_url.clone(),
            address,
            connection,
            Filters::new(None, None, until),
            Some(CommitmentConfig::confirmed()),
        ));
    }
    let mut pipeline = pipeline.build()?;
    let mut running = tokio::spawn(async move { pipeline.run().await });

    for (address, pending, newest) in backlog {
        while !pending
            .iter()
            .all(|s| store::seen(&db.lock().unwrap(), s).unwrap_or(false))
        {
            if running.is_finished() {
                return Err("pipeline stopped before the backlog was indexed".into());
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        // ponytail: the cursor moves once per start, after the backlog; a restart re-fetches (never re-applies)
        // what arrived since. Advance it from the processor if restarts get slow.
        if let Some(newest) = newest {
            store::set_cursor(&db.lock().unwrap(), &address, &newest)?;
        }
    }

    if std::env::args().any(|a| a == "--once") {
        let db = db.lock().unwrap();
        for h in store::holders(&db)? {
            println!(
                "{}  units={}  approved={}",
                h["wallet"].as_str().unwrap_or(""),
                h["units"].as_str().unwrap_or(""),
                h["approved"]
            );
        }
        println!("{} events indexed", store::event_count(&db)?);
        return Ok(());
    }

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", env("PORT", "8787").parse::<u16>()?)).await?;
    println!(
        "Indexing {}, serving on http://localhost:{}",
        cfg.sukuk_mint,
        listener.local_addr()?.port()
    );
    // Carbon's pipeline stops on Ctrl-C; the server goes down with it.
    tokio::select! {
        stopped = &mut running => stopped??,
        served = axum::serve(listener, api::router(cfg, db)) => served?,
    }
    Ok(())
}
