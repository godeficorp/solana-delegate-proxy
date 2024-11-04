use anchor_lang::error_code;

#[error_code]
pub enum Errors {
    #[msg("Wrong parameters")]
    WrongParameters,
    #[msg("Allowed Target List is empty")]
    EmptyAllowList,
    #[msg("Allowed Target List is too long")]
    AllowListTooLong,
    #[msg("Unknown account")]
    UnknownAccount,
    #[msg("To and From account mints are not the same")]
    MintsMismatch,
    #[msg("Proxy is deactivated")]
    DeactivatedProxy,
    #[msg("Transfer authority should be different from Deactivate authority")]
    SameAccounts,
    #[msg("Not allowed to deactivate")]
    WrongDeactivateAccount,
    #[msg("Not allowed to activate")]
    NotAllowedToActivate
}