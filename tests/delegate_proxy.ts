import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import * as splToken from "@solana/spl-token"
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet"
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { DelegateProxyProgram } from "../target/types/delegate_proxy_program"

chai.use(chaiAsPromised)
const expect = chai.expect


describe("delegate_proxy", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const sender = provider.wallet.publicKey
  const payer = (provider.wallet as NodeWallet).payer

  const receiver = anchor.web3.Keypair.generate()

  const program = anchor.workspace.DelegateProxyProgram as
    Program<DelegateProxyProgram>

  const transferAuthority = anchor.web3.Keypair.generate()
  const activateAuthority = anchor.web3.Keypair.generate()

  let [delegateProxy] = anchor.web3.PublicKey.findProgramAddressSync([
    anchor.utils.bytes.utf8.encode("delegate-proxy"),
    transferAuthority.publicKey.toBuffer()
  ], program.programId)

  let senderTokenAccount: anchor.web3.PublicKey
  let receiverTokenAccount: anchor.web3.PublicKey
  let mint: splToken.Token

  const skipPreflight = false

  before(async () => {
    // console.log("Provider = ", provider.publicKey.toString())
    // console.log("Receiver = ", receiver.publicKey.toString())

    mint = await splToken.Token.createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      6,
      splToken.TOKEN_PROGRAM_ID
    )

    // console.log(`mint :: `, mint.publicKey.toString())
    senderTokenAccount = await mint.createAccount(sender)
    // console.log(`senderTokenAccount :: `, senderTokenAccount.toString())

    receiverTokenAccount = await mint.createAccount(receiver.publicKey)
    // console.log(`receiverTokenAccount :: `, receiverTokenAccount.toString())

    await mint.mintTo(senderTokenAccount, payer, [], 10_000_000_000)
  })

  it("Should not initialize with deactivate=transfer authority", async () => {
    const initTx = program.methods.initialize(
      transferAuthority.publicKey,
      transferAuthority.publicKey
    ).accounts({
      owner: payer.publicKey,
    }).remainingAccounts([{
      pubkey: receiverTokenAccount,
      isSigner: false,
      isWritable: false
    }]).signers([payer]).rpc({ skipPreflight })

    await expect(initTx).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should not initialize with deactivate=owner authority", async () => {
    const initTx = program.methods.initialize(
      transferAuthority.publicKey,
      payer.publicKey
    ).accounts({
      owner: payer.publicKey,
    }).remainingAccounts([{
      pubkey: receiverTokenAccount,
      isSigner: false,
      isWritable: false
    }]).signers([payer]).rpc({ skipPreflight })

    await expect(initTx).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should initialize properly with the correct data", async () => {
    const initTx = await program.methods.initialize(
      transferAuthority.publicKey,
      activateAuthority.publicKey
    ).accounts({
      owner: payer.publicKey,
    }).remainingAccounts([{
      pubkey: receiverTokenAccount,
      isSigner: false,
      isWritable: false
    }]).signers([payer]).rpc({ skipPreflight: skipPreflight })
    // console.log("TX: init transaction signature", initTx)
  })

  it("Should reject a transfer from an account with wrong mint", async () => {
    const newMint = await splToken.Token.createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      6,
      splToken.TOKEN_PROGRAM_ID
    )

    // console.log(`newMint :: `, newMint.publicKey.toString())
    const newSenderTokenAccount = await newMint.createAccount(sender)
    await newMint.mintTo(newSenderTokenAccount, payer, [], 10_000_000_000)
    await newMint.approve(
      newSenderTokenAccount,
      delegateProxy,
      payer,
      [],
      10_000_000
    )

    await expect(
      proxyTransfer(
        transferAuthority,
        delegateProxy,
        newSenderTokenAccount,
        receiverTokenAccount,
        10_000
      )
    ).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should transfer some of approved amount with correct data", async () => {
    await proxyApprove(
      transferAuthority.publicKey,
      delegateProxy,
      senderTokenAccount,
      payer,
      10_000_000
    )

    await proxyTransfer(
      transferAuthority,
      delegateProxy,
      senderTokenAccount,
      receiverTokenAccount,
      10_000
    )
  })

  it("Should reject a transfer with wrong authority", async () => {
    let wrong = activateAuthority
    await expect(
      proxyTransfer(
        wrong,
        delegateProxy,
        senderTokenAccount,
        receiverTokenAccount,
        10_000
      )
    ).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should reject a transfer to a disallowed target", async () => {
    let wrongTarget = senderTokenAccount
    await expect(
      proxyTransfer(
        transferAuthority,
        delegateProxy,
        senderTokenAccount,
        wrongTarget,
        10_000
      )
    ).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should reject a transfer if deactivated", async () => {
    const deactivateTx = await program.methods.deactivate()
      .accounts({
        signer: activateAuthority.publicKey,
        transferAuthority: transferAuthority.publicKey,
      }).signers([activateAuthority]).rpc({ skipPreflight })
    // console.log("TX: deactivate transaction signature", deactivateTx)

    await expect(
      proxyTransfer(
        transferAuthority,
        delegateProxy,
        senderTokenAccount,
        receiverTokenAccount,
        10_000
      )
    ).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should not activate with deactivation authority", async () => {
    const activateTx = program.methods.activate()
      .accounts({
        signer: activateAuthority.publicKey,
        transferAuthority: transferAuthority.publicKey,
      }).signers([activateAuthority]).rpc({ skipPreflight })

    await expect(activateTx).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should allow a transfer when reactivated", async () => {
    // Reactivate
    const activateTx = await program.methods.activate()
      .accounts({
        signer: payer.publicKey,
        transferAuthority: transferAuthority.publicKey,
      }).signers([payer]).rpc({ skipPreflight: skipPreflight })
    // console.log("TX: activate transaction signature", activateTx)

    await proxyTransfer(
      transferAuthority,
      delegateProxy,
      senderTokenAccount,
      receiverTokenAccount,
      10_000
    )
  })


  async function proxyApprove(
    transferAuthority: anchor.web3.PublicKey,
    _delegateProxy: anchor.web3.PublicKey,
    senderToken: anchor.web3.PublicKey,
    senderTokenOwner: anchor.web3.Keypair,
    amount: number
  ) {
    const BNamount = new anchor.BN(amount)
    const approve = await program.methods.proxyApprove(BNamount)
      .accounts({
        transferAuthority,
        tokenAccount: senderToken
      }).signers([senderTokenOwner]).rpc({ skipPreflight: skipPreflight })
    // console.log("TX: approve transaction signature", approve)
  }

  async function proxyTransfer(
    transferAuthority: anchor.web3.Keypair,
    _delegateProxy: anchor.web3.PublicKey,
    senderToken: anchor.web3.PublicKey,
    receiverToken: anchor.web3.PublicKey,
    amount: number
  ) {
    const BNamount = new anchor.BN(amount)
    const transfer = await program.methods.proxyTransfer(BNamount)
      .accounts({
        transferAuthority: transferAuthority.publicKey,
        from: senderToken,
        to: receiverToken
      }).signers([transferAuthority]).rpc({ skipPreflight: skipPreflight })
    // console.log("TX: transfer transaction signature", transfer)
  }
});
