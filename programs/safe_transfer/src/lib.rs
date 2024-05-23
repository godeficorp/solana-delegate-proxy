use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use crate::errors::Errors;
use crate::base_account::BaseAccount;

pub mod errors;
pub mod base_account;

declare_id!("B122vRCxftMzwqMBWFpghXzjzAskGzn3nLnuFbdvdgo4");

#[program]
pub mod safe_transfer {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, transfer: Pubkey, deactivate: Pubkey) -> Result<()> {
        if ctx.remaining_accounts.len() < 1 {
            return err!(Errors::EmptyWhiteList);
        }

        if ctx.remaining_accounts.len() > 10 {
            return err!(Errors::WhiteListTooLong);
        }

        let mut whitelist: [Pubkey; 10] = Default::default();
        for (i, elem) in ctx.remaining_accounts.iter().enumerate() {
            whitelist[i] = elem.key();
        }

        let base = &mut ctx.accounts.base_account;
        base.active = true;
        base.bump = ctx.bumps.base_account;
        base.owner = ctx.accounts.owner.key();
        base.transfer_authority = transfer;
        base.deactivation_authority = deactivate;
        base.whitelisted_targets = whitelist;
        
        Ok(())
    }

    pub fn safe_transfer(ctx: Context<SafeTransfer>, amount: u64) -> Result<()> {
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.base_account.to_account_info(),
        };

        let seeds = &[&[
            BaseAccount::BASE_ACCOUNT_SEED,
            ctx.accounts.base_account.transfer_authority.as_ref(),
            &[ctx.accounts.base_account.bump],
        ] as &[&[u8]]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds);
        
        token::transfer(cpi_ctx, amount)
    }

    pub fn deactivate(ctx: Context<Deactivate>) -> Result<()> {
        let base = &mut ctx.accounts.base_account;
        base.active = false;

        Ok(())
    }

    pub fn activate(ctx: Context<Activate>) -> Result<()> {
        let base = &mut ctx.accounts.base_account;
        base.active = true;

        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(transfer: Pubkey, deactivate: Pubkey)]
pub struct Initialize<'info> {
    #[account(
        mut,
        signer, 
        constraint = owner.key() != transfer && owner.key() != deactivate @ Errors::SameAccounts
    )]
    owner: Signer<'info>,

    #[account(
        init, 
        payer = owner,  
        space = BaseAccount::LEN,
        seeds = [BaseAccount::BASE_ACCOUNT_SEED, transfer.key().as_ref()],
        bump,
        constraint = transfer != deactivate @ Errors::SameAccounts
    )]
    base_account: Account<'info, BaseAccount>,

    rent: Sysvar<'info, Rent>,
    system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct SafeTransfer<'info> {
    #[account(signer)]
    transfer_authority: Signer<'info>,

    #[account(
        seeds = [BaseAccount::BASE_ACCOUNT_SEED, transfer_authority.key().as_ref()],
        bump = base_account.bump,
        constraint = base_account.transfer_authority == transfer_authority.key() @ Errors::UnknownAccount,
        constraint = base_account.whitelisted_targets.contains(&to.key()) @ Errors::UnknownAccount,
        constraint = base_account.active == true @ Errors::DeactivatedAccount
    )]
    base_account: Account<'info, BaseAccount>,

    #[account(mut)]
    from: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = to.mint == from.mint @ Errors::MintsMismatch 
    )]
    to: Account<'info, TokenAccount>,

    token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Deactivate<'info> {
    #[account(
        signer,
        constraint = base_account.deactivation_authority == signer.key() 
            || base_account.owner == signer.key() @ Errors::WrongDeactivateAccount
    )]
    signer: Signer<'info>,

    /// CHECK: service account used as part of seed
    transfer_authority:  AccountInfo<'info>,

    #[account(
        mut,
        seeds = [BaseAccount::BASE_ACCOUNT_SEED, transfer_authority.key().as_ref()],
        bump = base_account.bump
    )]
    base_account: Account<'info, BaseAccount>,
}

#[derive(Accounts)]
pub struct Activate<'info> {
    #[account(
        signer,
        constraint = base_account.owner == signer.key() @ Errors::WrongOwnerAccount
    )]
    signer: Signer<'info>,

    /// CHECK: service account used as part of seed
    transfer_authority:  AccountInfo<'info>,

    #[account(
        mut,
        seeds = [BaseAccount::BASE_ACCOUNT_SEED, transfer_authority.key().as_ref()],
        bump = base_account.bump
    )]
    base_account: Account<'info, BaseAccount>,
}
