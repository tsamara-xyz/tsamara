use anchor_lang::prelude::*;

use crate::{error::ComplianceError, state::*};

#[derive(Accounts)]
pub struct RegisterInvestor<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub compliance: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        has_one = compliance @ ComplianceError::NotComplianceAuthority
    )]
    pub config: Account<'info, SeriesConfig>,
    /// CHECK: any wallet; the record is keyed by it.
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + InvestorRecord::INIT_SPACE,
        seeds = [INVESTOR_SEED, config.mint.as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub investor: Account<'info, InvestorRecord>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_investor(
    ctx: Context<RegisterInvestor>,
    jurisdiction: [u8; 2],
) -> Result<()> {
    require!(
        !ctx.accounts.config.is_restricted(&jurisdiction),
        ComplianceError::RestrictedJurisdiction
    );
    ctx.accounts.investor.set_inner(InvestorRecord {
        wallet: ctx.accounts.wallet.key(),
        jurisdiction,
        bump: ctx.bumps.investor,
    });
    Ok(())
}
