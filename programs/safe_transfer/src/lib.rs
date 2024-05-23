use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use crate::errors::Errors;
use crate::delegate_proxy::DelegateProxy;

pub mod errors;
pub mod delegate_proxy;

declare_id!("B122vRCxftMzwqMBWFpghXzjzAskGzn3nLnuFbdvdgo4");

#[program]
pub mod delegate_proxy_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, transfer_authority: Pubkey, deactivate_authority: Pubkey) -> Result<()> {
        if ctx.remaining_accounts.len() < 1 {
            return err!(Errors::EmptyWhiteList);
        }

        if ctx.remaining_accounts.len() > 10 {
            return err!(Errors::WhiteListTooLong);
        }

        let mut allowed_transfer_targets: [Pubkey; 10] = Default::default();
        for (i, elem) in ctx.remaining_accounts.iter().enumerate() {
            allowed_transfer_targets[i] = elem.key();
        }

        let proxy = &mut ctx.accounts.delegate_proxy;
        proxy.active = true;
        proxy.bump = ctx.bumps.delegate_proxy;
        proxy.owner = ctx.accounts.owner.key();
        proxy.transfer_authority = transfer_authority;
        proxy.deactivate_authority = deactivate_authority;
        proxy.allowed_transfer_targets = allowed_transfer_targets;
        
        Ok(())
    }

    pub fn proxy_transfer(ctx: Context<ProxyTransfer>, amount: u64) -> Result<()> {
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.delegate_proxy.to_account_info(),
        };

        let seeds = &[&[
            DelegateProxy::DELEGATE_PROXY_SEED,
            ctx.accounts.delegate_proxy.transfer_authority.as_ref(),
            &[ctx.accounts.delegate_proxy.bump],
        ] as &[&[u8]]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds);
        
        token::transfer(cpi_ctx, amount)
    }

    pub fn deactivate(ctx: Context<Deactivate>) -> Result<()> {
        let proxy = &mut ctx.accounts.delegate_proxy;
        proxy.active = false;

        Ok(())
    }

    pub fn activate(ctx: Context<Activate>) -> Result<()> {
        let proxy = &mut ctx.accounts.delegate_proxy;
        proxy.active = true;

        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(transfer_authority: Pubkey, deactivate_authority: Pubkey)]
pub struct Initialize<'info> {
    #[account(
        mut,
        signer, 
        constraint = owner.key() != transfer_authority && owner.key() != deactivate_authority @ Errors::SameAccounts
    )]
    owner: Signer<'info>,

    #[account(
        init, 
        payer = owner,  
        space = DelegateProxy::LEN,
        seeds = [DelegateProxy::DELEGATE_PROXY_SEED, transfer_authority.key().as_ref()],
        bump,
        constraint = transfer_authority != deactivate_authority @ Errors::SameAccounts
    )]
    delegate_proxy: Account<'info, DelegateProxy>,

    rent: Sysvar<'info, Rent>,
    system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct ProxyTransfer<'info> {
    #[account(signer)]
    transfer_authority: Signer<'info>,

    #[account(
        seeds = [DelegateProxy::DELEGATE_PROXY_SEED, transfer_authority.key().as_ref()],
        bump = delegate_proxy.bump,
        constraint = delegate_proxy.transfer_authority == transfer_authority.key() @ Errors::UnknownAccount,
        constraint = delegate_proxy.allowed_transfer_targets.contains(&to.key()) @ Errors::UnknownAccount,
        constraint = delegate_proxy.active == true @ Errors::DeactivatedProxy
    )]
    delegate_proxy: Account<'info, DelegateProxy>,

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
        constraint = delegate_proxy.deactivate_authority == signer.key() 
            || delegate_proxy.owner == signer.key() @ Errors::WrongDeactivateAccount
    )]
    signer: Signer<'info>,

    /// CHECK: service account used as part of seed
    transfer_authority:  AccountInfo<'info>,

    #[account(
        mut,
        seeds = [DelegateProxy::DELEGATE_PROXY_SEED, transfer_authority.key().as_ref()],
        bump = delegate_proxy.bump
    )]
    delegate_proxy: Account<'info, DelegateProxy>,
}

#[derive(Accounts)]
pub struct Activate<'info> {
    #[account(
        signer,
        constraint = delegate_proxy.owner == signer.key() @ Errors::NotAllowedToActivate
    )]
    signer: Signer<'info>,

    /// CHECK: service account used as part of seed
    transfer_authority:  AccountInfo<'info>,

    #[account(
        mut,
        seeds = [DelegateProxy::DELEGATE_PROXY_SEED, transfer_authority.key().as_ref()],
        bump = delegate_proxy.bump
    )]
    delegate_proxy: Account<'info, DelegateProxy>,
}
