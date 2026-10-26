import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AnchorProvider, Program, BN } from "@anchor-lang/core";
import { Surfnet } from "@solana/surfpool";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, it } from "mocha";

const idlPath = resolve("packages/protocol-client/src/generated/idl/freelance_escrow.json");
const soPath = resolve("target/deploy/freelance_escrow.so");
const idl: any = JSON.parse(readFileSync(idlPath, "utf8"));
const pk = (s: string) => new PublicKey(s);
function wallet(keypair: Keypair): any {
  return { publicKey: keypair.publicKey, signTransaction: async (tx: any) => { tx.partialSign(keypair); return tx; }, signAllTransactions: async (txs: any[]) => txs.map(tx => { tx.partialSign(keypair); return tx; }) };
}
function pda(programId: PublicKey, requester: PublicKey, id: Uint8Array) {
  const agreement = PublicKey.findProgramAddressSync([Buffer.from("agreement"), requester.toBuffer(), Buffer.from(id)], programId)[0];
  const vault = PublicKey.findProgramAddressSync([Buffer.from("vault"), agreement.toBuffer()], programId)[0];
  return { agreement, vault };
}
function fail(action: Promise<unknown>) { return assert.rejects(action); }

describe("freelance escrow on Surfpool", function () {
  this.timeout(120_000);
  it("checks authorization and hashes, and settles every timeout/resolver path exactly once", async () => {
    const surf = Surfnet.start();
    let connection: Connection | undefined;
    try {
      const programId = pk(idl.address);
      surf.deploy({ programId: programId.toBase58(), soPath, idlPath });
      const conn = new Connection(surf.rpcUrl, { commitment: "confirmed", wsEndpoint: surf.wsUrl });
      connection = conn;
      const payer = Keypair.fromSecretKey(surf.payerSecretKey);
      const requester = Keypair.generate(), provider = Keypair.generate(), primary = Keypair.generate(), backup = Keypair.generate(), stranger = Keypair.generate();
      surf.fundSolMany([requester, provider, primary, backup, stranger].map(k => ({ address: k.publicKey.toBase58(), lamports: 5_000_000_000 })));
      const client = new Program(idl, new AnchorProvider(conn, wallet(payer), { commitment: "confirmed" })) as any;
      let seq = 0;
      const create = async () => {
        const id = new Uint8Array(16); id[15] = ++seq;
        const { agreement, vault } = pda(programId, requester.publicKey, id);
        const hash = new Uint8Array(32).fill(seq);
        await client.methods.createAgreement([...id], provider.publicKey, primary.publicKey, backup.publicKey, new BN(10_000_000), new BN(60), new BN(60), new BN(60), [...hash]).accounts({ requester: requester.publicKey, agreement, vault, systemProgram: SystemProgram.programId }).signers([requester]).rpc();
        return { agreement, vault, hash };
      };
      const acceptAndFund = async (a: any, suppliedHash = a.hash) => {
        await client.methods.acceptAgreement([...suppliedHash]).accounts({ provider: provider.publicKey, agreement: a.agreement }).signers([provider]).rpc();
        await client.methods.fundAgreement().accounts({ requester: requester.publicKey, agreement: a.agreement, vault: a.vault, systemProgram: SystemProgram.programId }).signers([requester]).rpc();
      };
      const submit = async (a: any) => client.methods.submitWork([...new Uint8Array(32).fill(7)]).accounts({ provider: provider.publicKey, agreement: a.agreement }).signers([provider]).rpc();
      const advance = async (seconds: number) => {
        const clock = await conn.getBlockTime(await conn.getSlot());
        surf.timeTravelToTimestamp(((clock || Math.floor(Date.now() / 1000)) + seconds) * 1000);
      };

      const mismatch = await create();
      await fail(client.methods.acceptAgreement([...new Uint8Array(32)]).accounts({ provider: provider.publicKey, agreement: mismatch.agreement }).signers([provider]).rpc());
      await fail(client.methods.acceptAgreement([...mismatch.hash]).accounts({ provider: stranger.publicKey, agreement: mismatch.agreement }).signers([stranger]).rpc());
      await acceptAndFund(mismatch);
      await advance(61);
      await client.methods.refundAfterDeliveryTimeout().accounts({ requester: requester.publicKey, provider: provider.publicKey, agreement: mismatch.agreement, vault: mismatch.vault }).rpc();
      assert.ok((await client.account.agreement.fetch(mismatch.agreement)).status.refunded);
      await fail(client.methods.refundAfterDeliveryTimeout().accounts({ requester: requester.publicKey, provider: provider.publicKey, agreement: mismatch.agreement, vault: mismatch.vault }).rpc());

      const review = await create(); await acceptAndFund(review); await submit(review); await advance(61);
      await client.methods.releaseAfterReviewTimeout().accounts({ requester: requester.publicKey, provider: provider.publicKey, agreement: review.agreement, vault: review.vault }).rpc();
      assert.ok((await client.account.agreement.fetch(review.agreement)).status.settled);

      const resolver = await create(); await acceptAndFund(resolver); await submit(resolver);
      await client.methods.openDispute().accounts({ requester: requester.publicKey, provider: provider.publicKey, agreement: resolver.agreement, vault: resolver.vault }).signers([requester]).rpc();
      await fail(client.methods.resolveDispute({ refundRequester: {} }).accounts({ resolver: stranger.publicKey, requester: requester.publicKey, provider: provider.publicKey, agreement: resolver.agreement, vault: resolver.vault }).signers([stranger]).rpc());
      await advance(61);
      await client.methods.advanceToBackupResolver().accounts({ agreement: resolver.agreement }).rpc();
      await client.methods.resolveDispute({ refundRequester: {} }).accounts({ resolver: backup.publicKey, requester: requester.publicKey, provider: provider.publicKey, agreement: resolver.agreement, vault: resolver.vault }).signers([backup]).rpc();
      assert.ok((await client.account.agreement.fetch(resolver.agreement)).status.refunded);
      await fail(client.methods.resolveDispute({ refundRequester: {} }).accounts({ resolver: backup.publicKey, requester: requester.publicKey, provider: provider.publicKey, agreement: resolver.agreement, vault: resolver.vault }).signers([backup]).rpc());

      const finalTimeout = await create(); await acceptAndFund(finalTimeout); await submit(finalTimeout);
      await client.methods.openDispute().accounts({ requester: requester.publicKey, provider: provider.publicKey, agreement: finalTimeout.agreement, vault: finalTimeout.vault }).signers([requester]).rpc();
      await advance(61);
      await client.methods.advanceToBackupResolver().accounts({ agreement: finalTimeout.agreement }).rpc();
      await advance(61);
      await client.methods.refundAfterBackupTimeout().accounts({ requester: requester.publicKey, provider: provider.publicKey, agreement: finalTimeout.agreement, vault: finalTimeout.vault }).rpc();
      assert.ok((await client.account.agreement.fetch(finalTimeout.agreement)).status.refunded);
    } finally { surf.stop(); }
  });
});
