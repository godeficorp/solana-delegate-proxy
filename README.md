# Solana Delegate Proxy

Solana Program Implementing a Delegate Proxy with Transfer Target List

## Purpose

The Solana Program Library Token (SPL Token) program includes a feature
for token balance delegation (see references 1 and 2). At GoDefi, we
found this feature particularly useful for implementing a zero-value-locked
payment system.

However, using this feature comes with risks, primarily related to potential
attacks on the private keys of the account designated as the delegation target,
especially if that account is an externally owned account (not a program account).
When multiple users delegate token balances to such an account, it can create
a potential honeypot. If an attacker gains access to this key, they can transfer
the delegated funds from multiple accounts to their own, as the standard
delegation mechanism in SPL grants full authority over the delegated funds.

This program introduces an intermediary (proxy) account that adds a layer of
security by only allowing transfers to designated target accounts. This setup
enables the transfer authority to be the only "hot" account, which requires
continuous private key access for immediate customer-initiated transfers. The
list of allowed target accounts can remain as "cold" wallets, along with the
program control authorities. This significantly reduces the attack surface and
limits the value of compromising the transfer authority key, as obtaining this
key would not enable an attacker to move funds outside the system’s authorized
control.

References:
1. SPL Token Authority Delegation https://spl.solana.com/token#authority-delegation
2. SPL Token Program Source Code https://github.com/solana-labs/solana-program-library/blob/b8a6160a2705b7fcec3b7cedab8cb177131db736/token/program/src/instruction.rs#L111-L142

## Deployments

The program is currently deployed:

```
Solana Mainnet:
6ZHDCwMV29d8N1bxeKAm9aZMx2nW2i1SA416WxxvMPtT
```

## Development Setup

The project was last built and tested using the following versions:

```
solana --version
solana-cli 1.18.8 (src:e2d34d37; feat:3469865029, client:SolanaLabs)

rustc --version
rustc 1.78.0 (9b00956e5 2024-04-29)

node -v
v21.4.0

anchor --version
anchor-cli 0.30.0
```
