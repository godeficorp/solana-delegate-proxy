use anchor_lang::prelude::*;

#[account]
pub struct DelegateProxy {
    pub active: bool,
    pub bump: u8,
    pub owner: Pubkey,
    pub transfer_authority: Pubkey,
    pub deactivate_authority: Pubkey,
    pub allowed_transfer_targets: [Pubkey; 10]
}

impl DelegateProxy {
    pub const DELEGATE_PROXY_SEED: &'static [u8] = b"delegate-proxy";
    pub const LEN: usize = 8 + 1 + 1 + 32 + 32 + 32 + (32 * 10); // 426
}
