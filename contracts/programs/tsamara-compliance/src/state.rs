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

#[cfg(test)]
mod tests {
    use super::*;

    fn config(restricted: &[[u8; 2]]) -> SeriesConfig {
        SeriesConfig {
            mint: Pubkey::default(),
            compliance: Pubkey::default(),
            max_holding: 100,
            restricted_jurisdictions: restricted.to_vec(),
            bump: 255,
        }
    }

    #[test]
    fn restricted_jurisdictions_match_exactly() {
        let config = config(&[*b"US", *b"KP"]);
        assert!(config.is_restricted(b"US"));
        assert!(config.is_restricted(b"KP"));
        assert!(!config.is_restricted(b"AE"));
        // Codes are stored upper-case; the client normalises before sending.
        assert!(!config.is_restricted(b"us"));
    }

    #[test]
    fn nothing_is_restricted_by_default() {
        assert!(!config(&[]).is_restricted(b"US"));
    }

    #[test]
    fn config_space_fits_the_maximum_number_of_jurisdictions() {
        // 32 + 32 + 8 + (4 + 2 * MAX_RESTRICTED) + 1
        assert_eq!(SeriesConfig::INIT_SPACE, 77 + 2 * MAX_RESTRICTED);
    }
}
