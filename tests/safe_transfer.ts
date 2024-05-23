import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { SafeTransfer } from "../target/types/safe_transfer"
import * as splToken from "@solana/spl-token"
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet"
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiAsPromised)
const expect = chai.expect


describe("safe_transfer", () => {
  const provider =  anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const sender =  provider.wallet.publicKey
  const payer = (provider.wallet as NodeWallet).payer

  const receiver =  anchor.web3.Keypair.generate()

  const program = anchor.workspace.SafeTransfer as Program<SafeTransfer>

  const baseTransferAuthority = anchor.web3.Keypair.generate()
  const baseActivateAuthority = anchor.web3.Keypair.generate()

  let [safeTransferBase] = anchor.web3.PublicKey.findProgramAddressSync([
    anchor.utils.bytes.utf8.encode("base-account"),
    baseTransferAuthority.publicKey.toBuffer()
  ], program.programId)

  let senderTokenAccount: anchor.web3.PublicKey
  let receiverTokenAccount: anchor.web3.PublicKey
  let mint: splToken.Token

  const skipPreflight = false

  before(async() => {

    console.log("Provider = ", provider.publicKey.toString())
    console.log("Receiver = ", receiver.publicKey.toString())

    mint = await splToken.Token.createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      6,
      splToken.TOKEN_PROGRAM_ID
    )

    console.log(`mint :: `, mint.publicKey.toString())
    senderTokenAccount = await mint.createAccount(sender)
    console.log(`senderTokenAccount :: `, senderTokenAccount.toString())

    receiverTokenAccount = await mint.createAccount(receiver.publicKey)
    console.log(`receiverTokenAccount :: `, receiverTokenAccount.toString())

    await mint.mintTo(senderTokenAccount, payer, [], 10_000_000_000)
  })

  it("Should not allow to initialize with same deactivate and transfer authorities", async () => {
    const initTx = program.methods.initialize(baseTransferAuthority.publicKey, baseTransferAuthority.publicKey).accounts({
      owner: payer.publicKey,
      baseAccount: safeTransferBase,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId
    }).remainingAccounts([{
      pubkey: receiverTokenAccount,
      isSigner: false,
      isWritable: false
    }]).signers([payer]).rpc({skipPreflight: skipPreflight})

    await expect(initTx).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should not allow to initialize with same deactivate and owner authorities", async () => {
    const initTx = program.methods.initialize(baseTransferAuthority.publicKey, payer.publicKey).accounts({
      owner: payer.publicKey,
      baseAccount: safeTransferBase,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId
    }).remainingAccounts([{
      pubkey: receiverTokenAccount,
      isSigner: false,
      isWritable: false
    }]).signers([payer]).rpc({skipPreflight: skipPreflight})

    await expect(initTx).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should initialize properly with correct data", async () => {
    const initTx = await program.methods.initialize(baseTransferAuthority.publicKey, baseActivateAuthority.publicKey).accounts({
      owner: payer.publicKey,
      baseAccount: safeTransferBase,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId
    }).remainingAccounts([{
      pubkey: receiverTokenAccount,
      isSigner: false,
      isWritable: false
    }]).signers([payer]).rpc({skipPreflight: skipPreflight})
    console.log("TX: init transaction signature", initTx)
  })

  it("Should not allow to transfer from different mint account", async () => {
    const newMint = await splToken.Token.createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      6,
      splToken.TOKEN_PROGRAM_ID
    )

    console.log(`newMint :: `, newMint.publicKey.toString())
    const newSenderTokenAccount = await newMint.createAccount(sender)
    await newMint.mintTo(newSenderTokenAccount, payer, [], 10_000_000_000)
    await newMint.approve(
      newSenderTokenAccount,
      safeTransferBase,
      payer,
      [],
      10_000_000
    )

    await expect(transfer(baseTransferAuthority, safeTransferBase, newSenderTokenAccount, receiverTokenAccount, 10_000))
      .to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should transfer some of approved amount with correct data", async () => {
    await mint.approve(
      senderTokenAccount,
      safeTransferBase,
      payer,
      [],
      10_000_000
    )

    await transfer(baseTransferAuthority, safeTransferBase, senderTokenAccount, receiverTokenAccount, 10_000)
  })

  it("Should not allow to transfer with wrong authority", async () => {
    let wrong = baseActivateAuthority
    await expect(transfer(wrong, safeTransferBase, senderTokenAccount, receiverTokenAccount, 10_000))
      .to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should not allow to transfer to targer that out of white list", async () => {
    let wrongTarget = senderTokenAccount
    await expect(transfer(baseTransferAuthority, safeTransferBase, senderTokenAccount, wrongTarget, 10_000))
      .to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should not allow to transfer if deactivated", async () => {
    const deactivateTx = await program.methods.deactivate()
    .accounts({
      signer: baseActivateAuthority.publicKey,
      transferAuthority: baseTransferAuthority.publicKey,
      baseAccount: safeTransferBase
    }).signers([baseActivateAuthority]).rpc({skipPreflight: skipPreflight})
    console.log("TX: deactivate transaction signature", deactivateTx)

    await expect(transfer(baseTransferAuthority, safeTransferBase, senderTokenAccount, receiverTokenAccount, 10_000))
      .to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should not allow to activate with deactivation authority", async () => {
    const activateTx = program.methods.activate()
    .accounts({
      signer: baseActivateAuthority.publicKey,
      transferAuthority: baseTransferAuthority.publicKey,
      baseAccount: safeTransferBase
    }).signers([baseActivateAuthority]).rpc({skipPreflight: skipPreflight})

    await expect(activateTx).to.be.rejectedWith(anchor.AnchorError)
  })

  it("Should allow to transfer when activated", async () => {
    // activate back
    const activateTx = await program.methods.activate()
    .accounts({
      signer: payer.publicKey,
      transferAuthority: baseTransferAuthority.publicKey,
      baseAccount: safeTransferBase
    }).signers([payer]).rpc({skipPreflight: skipPreflight})
    console.log("TX: activate transaction signature", activateTx)

    await transfer(baseTransferAuthority, safeTransferBase, senderTokenAccount, receiverTokenAccount, 10_000)
  })


  async function transfer(
    baseTransferAuthority: anchor.web3.Keypair, 
    safeTransferBase: anchor.web3.PublicKey, 
    senderToken: anchor.web3.PublicKey, 
    receiverToken: anchor.web3.PublicKey,
    amount: number
  ) {
    const BNamount = new anchor.BN(amount)
    const transfer = await program.methods.safeTransfer(BNamount)
      .accounts({
        transferAuthority: baseTransferAuthority.publicKey,
        baseAccount: safeTransferBase,
        from: senderToken,
        to: receiverToken
      }).signers([baseTransferAuthority]).rpc({skipPreflight: skipPreflight})
    console.log("TX: transfer transaction signature", transfer)
  }
});


