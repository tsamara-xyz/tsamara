//! Turns one transaction into Tsamara events, using only token balance changes and instruction types.

use serde::Serialize;

pub struct TokenBalance {
    pub mint: String,
    /// Empty when the RPC node did not report an owner.
    pub owner: String,
    pub amount: i128,
}

/// The subset of a Solana transaction the classifier reads.
pub struct Tx {
    pub signature: String,
    pub slot: u64,
    pub block_time: Option<i64>,
    pub pre: Vec<TokenBalance>,
    pub post: Vec<TokenBalance>,
    /// Token instruction types in the transaction, e.g. "thawAccount".
    pub instruction_types: Vec<&'static str>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub sukuk_mint: String,
    pub payment_mint: String,
    /// Owner of the treasury that receives subscriptions and pays distributions.
    pub issuer: String,
}

#[derive(Debug, PartialEq)]
pub struct Event {
    pub signature: String,
    pub slot: u64,
    pub time: Option<i64>,
    /// "approved" | "revoked" | "subscription" | "trade" | "distribution"
    pub kind: &'static str,
    pub wallet: String,
    pub counterparty: Option<String>,
    /// Sukuk units moved (0 for approvals and distributions).
    pub units: i128,
    /// Payment-token base units moved.
    pub amount: i128,
}

/// Net change per owner for one mint, in order of first appearance.
pub fn deltas(tx: &Tx, mint: &str) -> Vec<(String, i128)> {
    let mut d: Vec<(String, i128)> = Vec::new();
    let signed = tx.post.iter().map(|b| (b, 1)).chain(tx.pre.iter().map(|b| (b, -1)));
    for (b, sign) in signed.filter(|(b, _)| b.mint == mint && !b.owner.is_empty()) {
        // ponytail: linear scan per balance; a transaction holds a handful of token accounts.
        match d.iter_mut().find(|(owner, _)| *owner == b.owner) {
            Some((_, v)) => *v += sign * b.amount,
            None => d.push((b.owner.clone(), sign * b.amount)),
        }
    }
    d.retain(|(_, v)| *v != 0);
    d
}

pub fn classify(tx: &Tx, cfg: &Config) -> Vec<Event> {
    let event = |kind, wallet: &str, counterparty: Option<&str>, units, amount| Event {
        signature: tx.signature.clone(),
        slot: tx.slot,
        time: tx.block_time,
        kind,
        wallet: wallet.to_string(),
        counterparty: counterparty.map(String::from),
        units,
        amount,
    };
    let sukuk = deltas(tx, &cfg.sukuk_mint);
    let paid = deltas(tx, &cfg.payment_mint);
    let paid_to = |owner: &str| paid.iter().find(|(o, _)| o == owner).map_or(0, |(_, v)| *v);
    let gained: Vec<_> = sukuk.iter().filter(|(_, v)| *v > 0).collect();
    let lost: Vec<_> = sukuk.iter().filter(|(_, v)| *v < 0).collect();

    if let ([(buyer, units)], [(seller, _)]) = (gained.as_slice(), lost.as_slice()) {
        return vec![event("trade", buyer, Some(seller), *units, paid_to(buyer).abs())];
    }
    if let ([(investor, units)], []) = (gained.as_slice(), lost.as_slice()) {
        return vec![event(
            "subscription",
            investor,
            Some(&cfg.issuer),
            *units,
            paid_to(investor).abs(),
        )];
    }
    if sukuk.is_empty() && paid_to(&cfg.issuer) < 0 {
        return paid
            .iter()
            .filter(|(owner, v)| *owner != cfg.issuer && *v > 0)
            .map(|(owner, v)| event("distribution", owner, Some(&cfg.issuer), 0, *v))
            .collect();
    }
    // Approvals and revocations move no tokens; the affected wallets are the sukuk accounts in the transaction.
    let kind = if tx.instruction_types.contains(&"thawAccount") {
        "approved"
    } else if tx.instruction_types.contains(&"freezeAccount") {
        "revoked"
    } else {
        return vec![];
    };
    let mut wallets: Vec<&str> = Vec::new();
    for b in tx
        .post
        .iter()
        .filter(|b| b.mint == cfg.sukuk_mint && !b.owner.is_empty())
    {
        if !wallets.contains(&b.owner.as_str()) {
            wallets.push(&b.owner);
        }
    }
    wallets.into_iter().map(|w| event(kind, w, None, 0, 0)).collect()
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub fn cfg() -> Config {
        Config {
            sukuk_mint: "SUKUK".into(),
            payment_mint: "USDC".into(),
            issuer: "issuer".into(),
        }
    }
    pub fn b(mint: &str, owner: &str, amount: i128) -> TokenBalance {
        TokenBalance {
            mint: mint.into(),
            owner: owner.into(),
            amount,
        }
    }
    pub fn tx(pre: Vec<TokenBalance>, post: Vec<TokenBalance>, instruction_types: Vec<&'static str>) -> Tx {
        Tx {
            signature: "sig".into(),
            slot: 1,
            block_time: Some(1),
            pre,
            post,
            instruction_types,
        }
    }

    #[test]
    fn subscription_investor_pays_units_are_minted() {
        let events = classify(
            &tx(
                vec![b("USDC", "amira", 5000), b("USDC", "issuer", 0), b("SUKUK", "amira", 0)],
                vec![
                    b("USDC", "amira", 4000),
                    b("USDC", "issuer", 1000),
                    b("SUKUK", "amira", 100),
                ],
                vec!["transferChecked", "mintTo"],
            ),
            &cfg(),
        );
        assert_eq!(events.len(), 1);
        let e = &events[0];
        assert_eq!(
            (e.kind, e.wallet.as_str(), e.units, e.amount),
            ("subscription", "amira", 100, 1000)
        );
    }

    #[test]
    fn trade_units_move_one_way_payment_the_other() {
        let events = classify(
            &tx(
                vec![
                    b("SUKUK", "amira", 100),
                    b("SUKUK", "lukas", 0),
                    b("USDC", "lukas", 5000),
                    b("USDC", "amira", 4000),
                ],
                vec![
                    b("SUKUK", "amira", 60),
                    b("SUKUK", "lukas", 40),
                    b("USDC", "lukas", 4600),
                    b("USDC", "amira", 4400),
                ],
                vec![],
            ),
            &cfg(),
        );
        let e = &events[0];
        assert_eq!(
            (e.kind, e.wallet.as_str(), e.counterparty.as_deref(), e.units, e.amount),
            ("trade", "lukas", Some("amira"), 40, 400)
        );
    }

    #[test]
    fn distribution_one_event_per_holder_paid_from_the_treasury() {
        let events = classify(
            &tx(
                vec![b("USDC", "issuer", 1000), b("USDC", "amira", 0), b("USDC", "lukas", 0)],
                vec![b("USDC", "issuer", 974), b("USDC", "amira", 16), b("USDC", "lukas", 10)],
                vec![],
            ),
            &cfg(),
        );
        let got: Vec<_> = events.iter().map(|e| (e.kind, e.wallet.as_str(), e.amount)).collect();
        assert_eq!(got, [("distribution", "amira", 16), ("distribution", "lukas", 10)]);
    }

    #[test]
    fn approval_no_tokens_move_wallets_come_from_the_sukuk_accounts() {
        let bal = || vec![b("SUKUK", "amira", 0), b("SUKUK", "lukas", 0)];
        let events = classify(&tx(bal(), bal(), vec!["thawAccount", "thawAccount"]), &cfg());
        let got: Vec<_> = events.iter().map(|e| (e.kind, e.wallet.as_str())).collect();
        assert_eq!(got, [("approved", "amira"), ("approved", "lukas")]);
    }

    #[test]
    fn unrelated_transactions_produce_no_events() {
        assert_eq!(classify(&tx(vec![], vec![], vec!["transfer"]), &cfg()), vec![]);
    }
}
