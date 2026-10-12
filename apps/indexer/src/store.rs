//! SQLite storage: events, holders, and the bookkeeping that makes each transaction apply exactly once.

use crate::classify::{classify, deltas, Config, Tx};
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde_json::{json, Value};

pub fn open(path: &str) -> Result<Connection> {
    let db = Connection::open(path)?;
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS events (
           signature TEXT, slot INTEGER, time INTEGER, kind TEXT, wallet TEXT, counterparty TEXT, units TEXT, amount TEXT,
           PRIMARY KEY (signature, kind, wallet));
         CREATE TABLE IF NOT EXISTS holders (
           wallet TEXT PRIMARY KEY, units TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
           approved_slot INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE IF NOT EXISTS seen (signature TEXT PRIMARY KEY);
         CREATE TABLE IF NOT EXISTS cursor (address TEXT PRIMARY KEY, signature TEXT NOT NULL);",
    )?;
    Ok(db)
}

/// Events and balance changes for one transaction are written together, exactly once.
pub fn apply(db: &mut Connection, tx: &Tx, cfg: &Config) -> Result<()> {
    let t = db.transaction()?;
    if t.execute("INSERT OR IGNORE INTO seen VALUES (?1)", [&tx.signature])? == 0 {
        return Ok(());
    }
    for e in classify(tx, cfg) {
        t.execute(
            "INSERT OR IGNORE INTO events VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                e.signature,
                e.slot as i64,
                e.time,
                e.kind,
                e.wallet,
                e.counterparty,
                e.units.to_string(),
                e.amount.to_string()
            ],
        )?;
        if e.kind == "approved" || e.kind == "revoked" {
            // The crawler delivers history newest first, so the latest slot wins rather than the last write.
            // ponytail: an approval and a revocation of one wallet in the same slot resolve in arrival order;
            // order by transaction index within the block if that ever matters.
            t.execute(
                "INSERT INTO holders (wallet, units, approved, approved_slot) VALUES (?1, '0', ?2, ?3)
                 ON CONFLICT(wallet) DO UPDATE SET approved = excluded.approved, approved_slot = excluded.approved_slot
                 WHERE excluded.approved_slot >= holders.approved_slot",
                params![e.wallet, e.kind == "approved", e.slot as i64],
            )?;
        }
    }
    for (wallet, d) in deltas(tx, &cfg.sukuk_mint) {
        let units: Option<String> = t
            .query_row("SELECT units FROM holders WHERE wallet = ?1", [&wallet], |r| r.get(0))
            .optional()?;
        let units = units.and_then(|u| u.parse::<i128>().ok()).unwrap_or(0) + d;
        t.execute(
            "INSERT INTO holders (wallet, units) VALUES (?1, ?2) ON CONFLICT(wallet) DO UPDATE SET units = excluded.units",
            params![wallet, units.to_string()],
        )?;
    }
    t.commit()
}

pub fn seen(db: &Connection, signature: &str) -> Result<bool> {
    db.prepare("SELECT 1 FROM seen WHERE signature = ?1")?
        .exists([signature])
}

pub fn cursor(db: &Connection, address: &str) -> Result<Option<String>> {
    db.query_row("SELECT signature FROM cursor WHERE address = ?1", [address], |r| {
        r.get(0)
    })
    .optional()
}

pub fn set_cursor(db: &Connection, address: &str, signature: &str) -> Result<()> {
    db.execute(
        "INSERT INTO cursor VALUES (?1, ?2) ON CONFLICT(address) DO UPDATE SET signature = excluded.signature",
        [address, signature],
    )?;
    Ok(())
}

pub fn holders(db: &Connection) -> Result<Vec<Value>> {
    db.prepare("SELECT wallet, units, approved FROM holders ORDER BY CAST(units AS INTEGER) DESC")?
        .query_map([], |r| {
            Ok(json!({ "wallet": r.get::<_, String>(0)?, "units": r.get::<_, String>(1)?, "approved": r.get::<_, i64>(2)? }))
        })?
        .collect()
}

pub fn events(db: &Connection, wallet: Option<&str>) -> Result<Vec<Value>> {
    let sql = match wallet {
        Some(_) => "SELECT * FROM events WHERE wallet = ?1 OR counterparty = ?1 ORDER BY slot DESC LIMIT 500",
        None => "SELECT * FROM events WHERE ?1 IS NULL ORDER BY slot DESC LIMIT 200",
    };
    db.prepare(sql)?
        .query_map([wallet], |r| {
            Ok(json!({
                "signature": r.get::<_, String>(0)?,
                "slot": r.get::<_, i64>(1)?,
                "time": r.get::<_, Option<i64>>(2)?,
                "kind": r.get::<_, String>(3)?,
                "wallet": r.get::<_, String>(4)?,
                "counterparty": r.get::<_, Option<String>>(5)?,
                "units": r.get::<_, String>(6)?,
                "amount": r.get::<_, String>(7)?,
            }))
        })?
        .collect()
}

pub fn event_count(db: &Connection) -> Result<i64> {
    db.query_row("SELECT COUNT(*) FROM events", [], |r| r.get(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::classify::tests::{b, cfg, tx};

    #[test]
    fn a_transaction_is_applied_once_and_approval_follows_the_latest_slot() {
        let mut db = open(":memory:").unwrap();
        let mint = tx(
            vec![b("SUKUK", "amira", 0)],
            vec![b("SUKUK", "amira", 100)],
            vec!["mintTo"],
        );
        apply(&mut db, &mint, &cfg()).unwrap();
        apply(&mut db, &mint, &cfg()).unwrap();

        // History arrives newest first: the revocation at slot 9 must survive the older approval at slot 5.
        let bal = || vec![b("SUKUK", "amira", 100)];
        let at = |signature: &str, slot, ix| Tx {
            signature: signature.into(),
            slot,
            ..tx(bal(), bal(), vec![ix])
        };
        apply(&mut db, &at("revoke", 9, "freezeAccount"), &cfg()).unwrap();
        apply(&mut db, &at("approve", 5, "thawAccount"), &cfg()).unwrap();

        assert_eq!(
            holders(&db).unwrap(),
            [json!({ "wallet": "amira", "units": "100", "approved": 0 })]
        );
        assert_eq!(event_count(&db).unwrap(), 3);
        assert_eq!(events(&db, Some("lukas")).unwrap().len(), 0);
        assert_eq!(events(&db, None).unwrap().len(), 3);
    }
}
