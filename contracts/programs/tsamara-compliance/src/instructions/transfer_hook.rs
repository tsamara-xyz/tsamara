use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::spl_token_2022::{
        extension::{
            transfer_hook::TransferHookAccount, BaseStateWithExtensions, StateWithExtensions,
        },
        state::Account as TokenAccountState,
    },
    token_interface::{Mint, TokenAccount},
};

use crate::{error::ComplianceError, state::*};

// Account order is fixed by the transfer hook interface: source, mint, destination, owner,
// extra account list, then the extra accounts declared in `initialize_series`.
#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(token::mint = mint)]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(token::mint = mint)]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: source owner or delegate, already validated by the token program.
    pub owner: UncheckedAccount<'info>,
    /// CHECK: address validated by seeds.
    #[account(seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    #[account(seeds = [CONFIG_SEED, mint.key().as_ref()], bump = config.bump)]
    pub config: Account<'info, SeriesConfig>,
    /// The recipient must have a record: an unregistered wallet makes this account fail to load.
    #[account(
        seeds = [INVESTOR_SEED, mint.key().as_ref(), destination_token.owner.as_ref()],
        bump = investor.bump
    )]
    pub investor: Account<'info, InvestorRecord>,
}

pub fn handle_transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
    assert_is_transferring(&ctx.accounts.source_token.to_account_info())?;

    // Restrictions can tighten after an investor was registered, so check again on every transfer.
    require!(
        !ctx.accounts
            .config
            .is_restricted(&ctx.accounts.investor.jurisdiction),
        ComplianceError::RestrictedJurisdiction
    );
    // Token-2022 moves the balance before invoking the hook, so this is the post-transfer holding.
    require!(
        ctx.accounts.destination_token.amount <= ctx.accounts.config.max_holding,
        ComplianceError::HoldingCapExceeded
    );
    Ok(())
}

/// Token-2022 sets `transferring` on the source account only for the duration of a transfer,
/// so the hook cannot be invoked directly by anyone else.
fn assert_is_transferring(source: &AccountInfo) -> Result<()> {
    let data = source.try_borrow_data()?;
    let account = StateWithExtensions::<TokenAccountState>::unpack(&data)?;
    let extension = account.get_extension::<TransferHookAccount>()?;
    require!(
        bool::from(extension.transferring),
        ComplianceError::NotTransferring
    );
    Ok(())
}
