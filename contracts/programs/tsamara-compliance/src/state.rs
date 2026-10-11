use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const INVESTOR_SEED: &[u8] = b"investor";
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";
pub const MAX_RESTRICTED: usize = 16;

/// Compliance rules for one sukuk series.
#[account]
#[derive(InitSpace)]
pub struct SeriesConfig {
    pub mint: Pubkey,
    /// The mint's freeze authority at initialization; the only key that can register investors.
    pub compliance: Pubkey,
    /// Maximum units a single investor may hold after a transfer.
    pub max_holding: u64,
    /// ISO 3166-1 alpha-2 codes whose residents may not hold this series.
    #[max_len(MAX_RESTRICTED)]
    pub restricted_jurisdictions: Vec<[u8; 2]>,
    pub bump: u8,
}

impl SeriesConfig {
    pub fn is_restricted(&self, jurisdiction: &[u8; 2]) -> bool {
        self.restricted_jurisdictions.contains(jurisdiction)
    }
}

/// A KYC'd investor for one series.
#[account]
#[derive(InitSpace)]
pub struct InvestorRecord {
    pub wallet: Pubkey,
    pub jurisdiction: [u8; 2],
    pub bump: u8,
}
