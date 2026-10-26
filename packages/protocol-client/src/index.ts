import { AnchorProvider, Program } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import idl from "./generated/idl/freelance_escrow.json";
import type { FreelanceEscrow } from "./generated/types/freelance_escrow";
export * from "./terms";

export function createEscrowProgram(provider: AnchorProvider) {
  return new Program(idl as FreelanceEscrow, provider);
}
export function deriveAgreementAddress(programId: PublicKey, requester: PublicKey, id: Uint8Array) {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("agreement"), requester.toBytes(), id], programId)[0];
}
export function deriveVaultAddress(programId: PublicKey, agreement: PublicKey) {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("vault"), agreement.toBytes()], programId)[0];
}
