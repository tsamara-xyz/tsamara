//! Tsamara compliance: a Token-2022 transfer hook that makes investor eligibility and
//! per-investor holding caps a property of the sukuk token itself.

pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

declare_id!("EjYxuJE4QE8P37scBxgWRHGigZ8hP6j3ysnSQ95MWXXG");

#[program]
pub mod tsamara_compliance {
    use super::*;

    /// Attach compliance rules to a sukuk mint. Only the mint's freeze authority may do this.
    pub fn initialize_series(
        ctx: Context<InitializeSeries>,
        max_holding: u64,
        restricted_jurisdictions: Vec<[u8; 2]>,
    ) -> Result<()> {
        instructions::initialize_series::handle_initialize_series(
            ctx,
            max_holding,
            restricted_jurisdictions,
        )
    }

    /// Record a KYC'd investor and their jurisdiction. Fails for restricted jurisdictions.
    pub fn register_investor(ctx: Context<RegisterInvestor>, jurisdiction: [u8; 2]) -> Result<()> {
        instructions::register_investor::handle_register_investor(ctx, jurisdiction)
    }

    /// Called by Token-2022 on every transfer of the sukuk. The discriminator is fixed by the
    /// transfer hook interface (`spl-transfer-hook-interface:execute`).
    #[instruction(discriminator = &[105, 37, 101, 197, 75, 251, 102, 26])]
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        instructions::transfer_hook::handle_transfer_hook(ctx, amount)
    }
}
