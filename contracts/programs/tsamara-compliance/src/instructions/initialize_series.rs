use anchor_lang::{prelude::*, solana_program::program_option::COption};
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::{error::ComplianceError, state::*};

#[derive(Accounts)]
pub struct InitializeSeries<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub compliance: Signer<'info>,
    #[account(
        constraint = mint.freeze_authority == COption::Some(compliance.key()) @ ComplianceError::NotComplianceAuthority
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = payer,
        space = 8 + SeriesConfig::INIT_SPACE,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, SeriesConfig>,
    /// CHECK: initialized below as the transfer hook's extra account list.
    #[account(
        init,
        payer = payer,
        space = ExtraAccountMetaList::size_of(2)?,
        seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_series(
    ctx: Context<InitializeSeries>,
    max_holding: u64,
    restricted_jurisdictions: Vec<[u8; 2]>,
) -> Result<()> {
    require!(
        restricted_jurisdictions.len() <= MAX_RESTRICTED,
        ComplianceError::TooManyJurisdictions
    );

    ctx.accounts.config.set_inner(SeriesConfig {
        mint: ctx.accounts.mint.key(),
        compliance: ctx.accounts.compliance.key(),
        max_holding,
        restricted_jurisdictions,
        bump: ctx.bumps.config,
    });

    // Accounts Token-2022 must pass to the hook on every transfer, resolved from the transfer itself:
    // index 1 is the mint, index 2 the destination token account (its owner sits at bytes 32..64).
    let metas = [
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: CONFIG_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 },
            ],
            false,
            false,
        )?,
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: INVESTOR_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 },
                Seed::AccountData {
                    account_index: 2,
                    data_index: 32,
                    length: 32,
                },
            ],
            false,
            false,
        )?,
    ];
    ExtraAccountMetaList::init::<ExecuteInstruction>(
        &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
        &metas,
    )?;
    Ok(())
}
