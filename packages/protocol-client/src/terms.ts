import { PublicKey } from "@solana/web3.js";

export type AgreementTermsV1 = {
  schemaVersion: 1; agreementId: string; requester: string; provider: string;
  primaryResolver: string; backupResolver: string; amountLamports: string;
  deliveryWindowSeconds: number; reviewWindowSeconds: number; resolverWindowSeconds: number;
  scope: string; acceptanceCriteria: string;
};

// RFC 8785 canonical JSON for this schema (which deliberately contains no floats).
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Terms contain a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  throw new Error("Terms contain an unsupported JSON value");
}

export function validateTerms(value: unknown): AgreementTermsV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Terms must be a JSON object");
  const t = value as AgreementTermsV1;
  if (t.schemaVersion !== 1) throw new Error("Unsupported terms schema version");
  if (!/^[0-9a-f]{32}$/.test(t.agreementId)) throw new Error("Invalid agreement ID");
  for (const role of [t.requester, t.provider, t.primaryResolver, t.backupResolver]) new PublicKey(role);
  if (new Set([t.requester, t.provider, t.primaryResolver, t.backupResolver]).size !== 4) throw new Error("All four roles need different wallets");
  if (!/^[1-9][0-9]*$/.test(t.amountLamports) || BigInt(t.amountLamports) > (1n << 64n) - 1n) throw new Error("Amount must be a positive u64 lamport string");
  for (const n of [t.deliveryWindowSeconds, t.reviewWindowSeconds, t.resolverWindowSeconds]) if (!Number.isSafeInteger(n) || n < 1 || n > 31_536_000) throw new Error("Time windows must be 1 second to 1 year");
  if (typeof t.scope !== "string" || !t.scope.trim()) throw new Error("Scope is required");
  if (typeof t.acceptanceCriteria !== "string" || !t.acceptanceCriteria.trim()) throw new Error("Acceptance criteria are required");
  return t;
}

export async function hashTerms(value: unknown): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalize(validateTerms(value)))));
}
export const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex: string) => {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("Expected a 32-byte lowercase hex hash");
  return Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16));
};
export function downloadTerms(terms: AgreementTermsV1) {
  const blob = new Blob([`${JSON.stringify(validateTerms(terms), null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `agreement-${terms.agreementId}.json`; a.click(); URL.revokeObjectURL(url);
}
