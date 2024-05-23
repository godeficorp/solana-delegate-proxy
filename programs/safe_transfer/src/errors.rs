use anchor_lang::error_code;

#[error_code]
pub enum Errors {
    #[msg("Wrong parameters")]
    WrongParameters,
    #[msg("Whitelist is empty")]
    EmptyWhiteList,
    #[msg("Whitelist too long")]
    WhiteListTooLong,
    #[msg("Unknown account")]
    UnknownAccount,
    #[msg("To and from account mints are not same")]
    MintsMismatch,
    #[msg("Account not active")]
    DeactivatedAccount,
    #[msg("Same accounts in configuration")]
    SameAccounts,
    #[msg("No permissions to deactivate")]
    WrongDeactivateAccount,
    #[msg("Only owner can activate transfers")]
    WrongOwnerAccount
}