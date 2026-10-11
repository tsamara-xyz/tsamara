use anchor_lang::prelude::*;

#[error_code]
pub enum ComplianceError {
    #[msg("Signer is not the mint's freeze authority")]
    NotComplianceAuthority,
    #[msg("Too many restricted jurisdictions")]
    TooManyJurisdictions,
    #[msg("The series is not offered to residents of this jurisdiction")]
    RestrictedJurisdiction,
    #[msg("Transfer would exceed the per-investor holding cap")]
    HoldingCapExceeded,
    #[msg("The hook may only run during a token transfer")]
    NotTransferring,
}
