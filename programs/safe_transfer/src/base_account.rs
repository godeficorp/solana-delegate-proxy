use anchor_lang::prelude::*;

#[account]
pub struct BaseAccount {
    pub active: bool,
    pub bump: u8,
    pub owner: Pubkey,
    pub transfer_authority: Pubkey,
    pub deactivation_authority: Pubkey,
    pub whitelisted_targets: [Pubkey; 10]
}
// add mint?
impl BaseAccount {
    pub const BASE_ACCOUNT_SEED: &'static [u8] = b"base-account";
    pub const LEN: usize = 8 + 1 + 1 + 32 + 32 + 32 + (32 * 10); // 426
}
