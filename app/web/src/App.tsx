import { useEffect, useMemo, useState } from "react";
import { AnchorProvider, BN } from "@anchor-lang/core";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createEscrowProgram, deriveAgreementAddress, deriveVaultAddress, downloadTerms, fromHex, hashTerms, toHex, validateTerms, type AgreementTermsV1 } from "@freelance-escrow/protocol-client";

function bytes(hex: string) { return Uint8Array.from(hex.match(/../g) || [], x => parseInt(x, 16)); }
function hex(bytes: Uint8Array) { return toHex(bytes); }
function pub(s: string) { return new PublicKey(s); }
function errText(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function App({ endpoint }: { endpoint: string }) {
  const { connection } = useConnection(); const wallet = useAnchorWallet();
  const provider = useMemo(() => wallet ? new AnchorProvider(connection, wallet, { commitment: "confirmed" }) : null, [connection, wallet]);
  const program = useMemo(() => provider ? createEscrowProgram(provider) as any : null, [provider]);
  const [terms, setTerms] = useState<AgreementTermsV1 | null>(null);
  const [agreementAddress, setAgreementAddress] = useState(""); const [state, setState] = useState<any>(null); const [vaultAvailable, setVaultAvailable] = useState(0);
  const [providerKey, setProviderKey] = useState(""); const [primaryKey, setPrimaryKey] = useState(""); const [backupKey, setBackupKey] = useState("");
  const [amount, setAmount] = useState("0.01"); const [scope, setScope] = useState("Create SHA-256 hashes and metadata for the agreed files.");
  const [criteria, setCriteria] = useState("Output contains the expected filename, byte length, and SHA-256 digest for each input file.");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [hashDisplay, setHashDisplay] = useState("");
  const walletKey = wallet?.publicKey;
  useEffect(() => { let live = true; if (terms) void hashTerms(terms).then(h => { if (live) setHashDisplay(toHex(h)); }); return () => { live = false; }; }, [terms]);
  const isRequester = !!state && walletKey?.equals(state.requester);
  const isProvider = !!state && walletKey?.equals(state.provider);
  const stageResolver = state?.resolverStage?.primary !== undefined ? "primary" : state?.resolverStage?.backup !== undefined ? "backup" : null;
  const isResolver = !!state && (stageResolver === "primary" ? walletKey?.equals(state.primaryResolver) : stageResolver === "backup" ? walletKey?.equals(state.backupResolver) : false);
  const tx = async (label: string, action: () => Promise<unknown>) => { setBusy(true); setMessage(`${label}…`); try { const result: any = await action(); setMessage(result ? `Confirmed: ${String(result)}` : `${label} complete`); await refresh(); } catch (e) { setMessage(errText(e)); } finally { setBusy(false); } };
  const addressFor = (t: AgreementTermsV1) => deriveAgreementAddress(program.programId, pub(t.requester), bytes(t.agreementId));
  const vaultFor = (address: PublicKey) => deriveVaultAddress(program.programId, address);
  async function refresh(address = agreementAddress) {
    if (!program || !address) return;
    const key = pub(address); const data = await program.account.agreement.fetch(key); setState(data); setAgreementAddress(key.toBase58()); const vault = deriveVaultAddress(program.programId, key); const balance = await connection.getBalance(vault); const reserve = await connection.getMinimumBalanceForRentExemption(41); setVaultAvailable(Math.max(0, balance - reserve));
  }
  async function create() {
    if (!walletKey || !program) throw new Error("Connect requester wallet first");
    const lamports = Math.round(Number(amount) * LAMPORTS_PER_SOL);
    if (!Number.isSafeInteger(lamports) || lamports <= 0) throw new Error("Enter a valid SOL amount (up to 9 decimals)");
    const t: AgreementTermsV1 = validateTerms({ schemaVersion: 1, agreementId: Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,"0")).join(""), requester: walletKey.toBase58(), provider: providerKey, primaryResolver: primaryKey, backupResolver: backupKey, amountLamports: String(lamports), deliveryWindowSeconds: 86400, reviewWindowSeconds: 86400, resolverWindowSeconds: 86400, scope, acceptanceCriteria: criteria });
    const digest = await hashTerms(t); const address = addressFor(t); const vault = vaultFor(address);
    await program.methods.createAgreement([...bytes(t.agreementId)], pub(t.provider), pub(t.primaryResolver), pub(t.backupResolver), new BN(t.amountLamports), new BN(t.deliveryWindowSeconds), new BN(t.reviewWindowSeconds), new BN(t.resolverWindowSeconds), [...digest]).accounts({ requester: walletKey, agreement: address, vault, systemProgram: SystemProgram.programId }).rpc();
    setTerms(t); downloadTerms(t); setAgreementAddress(address.toBase58()); await refresh(address.toBase58());
  }
  async function importFile(file?: File) {
    if (!file) return; const t = validateTerms(JSON.parse(await file.text())); const digest = await hashTerms(t); const address = addressFor(t);
    setTerms(t); setAgreementAddress(address.toBase58());
    if (!program) { setMessage(`Terms hash ${toHex(digest)}. Connect a wallet to compare with chain.`); return; }
    const data = await program.account.agreement.fetch(address);
    if (toHex(new Uint8Array(data.termsHash)) !== toHex(digest)) throw new Error("Terms hash mismatch: imported file does not match this agreement");
    setState(data); const balance = await connection.getBalance(vaultFor(address)); const reserve = await connection.getMinimumBalanceForRentExemption(41); setVaultAvailable(Math.max(0, balance - reserve)); setMessage(`Terms verified against ${address.toBase58()}`);
  }
  async function verified() {
    if (!terms || !program || !state) throw new Error("Import terms and load an agreement first");
    const digest = await hashTerms(terms);
    if (hex(new Uint8Array(state.termsHash)) !== hex(digest)) throw new Error("Terms hash mismatch");
    return { address: pub(agreementAddress), vault: vaultFor(pub(agreementAddress)), digest };
  }
  const action = (label: string, fn: () => Promise<unknown>) => () => tx(label, fn);
  const field = (label: string, value: string, set: (s:string)=>void, placeholder = "") => <label>{label}<input value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/></label>;
  return <main>
    <header><div><p className="eyebrow">LOCAL CLUSTER · SYNTHETIC DEMO</p><h1>Freelance escrow</h1><p className="sub">One agreement. One funded milestone. Rules both parties can inspect.</p></div><WalletMultiButton/></header>
    <section className="notice"><strong>Local only</strong><span>RPC: {endpoint}. Funds are Surfpool test SOL. Terms and deliverables stay in files you share yourself; hashes and transaction data are visible on this local cluster.</span></section>
    <div className="grid"><section className="card"><h2>1 · Draft agreement</h2><p className="muted">Connect the requester wallet, define roles, and download the versioned terms JSON.</p>
      {field("Provider wallet",providerKey,setProviderKey,"Base58 address")}{field("Primary resolver",primaryKey,setPrimaryKey,"Base58 address")}{field("Backup resolver",backupKey,setBackupKey,"Base58 address")}
      {field("Payment (SOL)",amount,setAmount,"0.01")}<label>Scope<textarea value={scope} onChange={e=>setScope(e.target.value)}/></label><label>Acceptance criteria<textarea value={criteria} onChange={e=>setCriteria(e.target.value)}/></label>
      <button disabled={!program||busy} onClick={()=>void tx("Creating agreement",create)}>Create + export terms</button>
    </section><section className="card"><h2>2 · Import / inspect</h2><p className="muted">The other participant imports the exact terms file. Hash comparison is required before actions.</p>
      <label>Terms JSON<input type="file" accept="application/json,.json" onChange={e=>void importFile(e.target.files?.[0]).catch(x=>setMessage(errText(x)))}/></label>
      {field("Agreement address",agreementAddress,setAgreementAddress,"PDA")}
      <div className="row"><button className="secondary" disabled={!program||busy||!agreementAddress} onClick={()=>void tx("Refreshing",()=>refresh())}>Load / refresh</button>{terms&&<button className="secondary" onClick={()=>downloadTerms(terms)}>Download terms</button>}</div>
      {terms&&<p className="hash">Terms SHA-256: {hashDisplay}</p>}
      {state&&<div className="state"><b>Status: {Object.keys(state.status||{})[0] || "unknown"}</b><span>Requester: {state.requester.toBase58()}</span><span>Provider: {state.provider.toBase58()}</span><span>Primary resolver: {state.primaryResolver.toBase58()}</span><span>Backup resolver: {state.backupResolver.toBase58()}</span><span>Committed: {(Number(state.amountLamports.toString())/LAMPORTS_PER_SOL).toFixed(9)} SOL</span><span>Verified in vault: {(vaultAvailable/LAMPORTS_PER_SOL).toFixed(9)} SOL</span><span>Terms match: {terms ? (hex(new Uint8Array(state.termsHash)) === hashDisplay ? "yes" : "no") : "import terms to verify"}</span><span>Submitted result hash: {hex(new Uint8Array(state.submittedResultHash))}</span><span>Delivery deadline: {state.deliveryDeadline.toNumber() ? new Date(state.deliveryDeadline.toNumber()*1000).toLocaleString() : "starts after funding"}</span><span>Review deadline: {state.reviewDeadline.toNumber() ? new Date(state.reviewDeadline.toNumber()*1000).toLocaleString() : "starts after submission"}</span><span>Resolver stage/deadline: {stageResolver || "not active"}{state.resolverDeadline.toNumber() ? ` · ${new Date(state.resolverDeadline.toNumber()*1000).toLocaleString()}` : ""}</span>{terms&&<><span>Scope: {terms.scope}</span><span>Acceptance criteria: {terms.acceptanceCriteria}</span><span>Windows: delivery {terms.deliveryWindowSeconds}s · review {terms.reviewWindowSeconds}s · resolver {terms.resolverWindowSeconds}s</span></>}</div>}
    </section></div>
    <section className="card actions"><h2>3 · Act as your wallet role</h2><p className="muted">Switch accounts in the wallet extension for requester, provider, and resolver actions.</p>
      {state&&<div className="row wrap">
        {state.status.proposed!==undefined&&isProvider&&<button disabled={busy} onClick={action("Accepting",async()=>{const v=await verified();return program.methods.acceptAgreement([...v.digest]).accounts({provider:walletKey,agreement:v.address}).rpc()})}>Accept terms</button>}
        {state.status.accepted!==undefined&&isRequester&&<button disabled={busy} onClick={action("Funding",async()=>{const v=await verified();return program.methods.fundAgreement().accounts({requester:walletKey,agreement:v.address,vault:v.vault,systemProgram:SystemProgram.programId}).rpc()})}>Fund milestone</button>}
        {state.status.funded!==undefined&&isProvider&&<label className="file-action">Submit result file<input type="file" onChange={e=>void (async()=>{const f=e.target.files?.[0];if(!f)return;await tx("Submitting result hash",async()=>{const v=await verified();const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",await f.arrayBuffer()));return program.methods.submitWork([...digest]).accounts({provider:walletKey,agreement:v.address}).rpc();});})()}/></label>}
        {state.status.submitted!==undefined&&isRequester&&<><button disabled={busy} onClick={action("Approving",async()=>{const v=await verified();return program.methods.approveAndRelease().accounts({requester:walletKey,provider:state.provider,agreement:v.address,vault:v.vault}).rpc()})}>Approve + pay provider</button><button className="secondary" disabled={busy} onClick={action("Opening dispute",async()=>{const v=await verified();return program.methods.openDispute().accounts({requester:walletKey,provider:state.provider,agreement:v.address,vault:v.vault}).rpc()})}>Dispute</button></>}
        {state.status.disputed!==undefined&&isResolver&&<><button disabled={busy} onClick={action("Resolving: release",async()=>{const v=await verified();return program.methods.resolveDispute({releaseToProvider:{}}).accounts({resolver:walletKey,provider:state.provider,requester:state.requester,agreement:v.address,vault:v.vault}).rpc()})}>Resolve: release</button><button className="secondary" disabled={busy} onClick={action("Resolving: refund",async()=>{const v=await verified();return program.methods.resolveDispute({refundRequester:{}}).accounts({resolver:walletKey,provider:state.provider,requester:state.requester,agreement:v.address,vault:v.vault}).rpc()})}>Resolve: refund</button></>}
        {state.status.funded!==undefined&&<button className="secondary" disabled={busy} onClick={action("Checking delivery timeout",async()=>{const v=await verified();return program.methods.refundAfterDeliveryTimeout().accounts({requester:state.requester,provider:state.provider,agreement:v.address,vault:v.vault}).rpc()})}>Refund after delivery deadline</button>}
        {state.status.submitted!==undefined&&<button className="secondary" disabled={busy} onClick={action("Checking review timeout",async()=>{const v=await verified();return program.methods.releaseAfterReviewTimeout().accounts({requester:state.requester,provider:state.provider,agreement:v.address,vault:v.vault}).rpc()})}>Release after review deadline</button>}
        {state.status.disputed!==undefined&&state.resolverStage.primary!==undefined&&<button className="secondary" disabled={busy} onClick={action("Advancing resolver",async()=>{const v=await verified();return program.methods.advanceToBackupResolver().accounts({agreement:v.address}).rpc()})}>Advance to backup resolver</button>}
        {state.status.disputed!==undefined&&state.resolverStage.backup!==undefined&&<button className="secondary" disabled={busy} onClick={action("Checking backup timeout",async()=>{const v=await verified();return program.methods.refundAfterBackupTimeout().accounts({requester:state.requester,provider:state.provider,agreement:v.address,vault:v.vault}).rpc()})}>Refund after backup deadline</button>}
      </div>}
      {message&&<p className="message">{busy&&<span className="spinner"/>}{message}</p>}
    </section>
    <footer>Agreement PDA: {agreementAddress||"not created or loaded"}</footer>
  </main>;
}
