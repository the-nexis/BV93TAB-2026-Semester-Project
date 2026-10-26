# Permissionless Freelance Escrow

A Solana protocol for clients and freelancers to agree on work, commit milestone funds, and settle according to rules accepted before work begins. The repo starts with a local browser demo: one agreement, one native SOL milestone, full payment or full refund. CLI and AI-agent workflows remain planned follow-on work using the same protocol client.

## Layout

- app/web: React + TypeScript + Vite browser UI
- packages/protocol-client: shared Anchor client and terms hashing
- programs/freelance_escrow: Anchor program and account state machine
- tests/program: Anchor integration tests on embedded Surfpool
- tests/flows: planned CLI and agent end-to-end flows
- scripts: toolchain and local-only setup
- cli and agents/demo: planned follow-on interfaces
- docs: architecture and decision records

## Requirements

Use Anchor 1.2.1, Solana CLI 4.1.2, Surfpool 1.6.1, Rust/Cargo, Node.js 18+, and Yarn 1.22+. On Arch or Ubuntu, run make bootstrap-arch or make bootstrap-ubuntu. Run make check, then make install. To add the toolchain directories to the current terminal's PATH, run `eval "$(make -s export)"` (or add that command to your shell startup file).

## Run locally

Terminal 1 starts an offline Surfpool at http://127.0.0.1:8899 and funds the
local deployment wallet with 10 synthetic SOL:

    make localnet

In terminal 2, build and deploy the program:

    make deploy-local

The deployment target checks that Surfpool is responding, tops up the dedicated
local wallet if needed, and discards an abandoned upgrade buffer only when its
account is absent from the current local cluster.

The first run creates a dedicated local-only wallet at ~/.config/solana/freelance-escrow-localnet.json and a program keypair under ignored target/. It never overwrites an existing local demo wallet. The setup prints public addresses only; the key files stay on your machine. They are for this offline local cluster, not for testnet or mainnet. The program ID is synced into Anchor.toml and Rust source for this checkout.

For tests, make test builds the program and runs the Anchor TypeScript integration suite against an embedded Surfpool. It needs no public RPC or external faucet. For the browser app, run make web and open the local Vite URL. The app connects to Surfpool at http://127.0.0.1:8899; Phantom connects as the signer and does not need RPC configuration. Use local-only wallets for each demo role. Fund those wallets on Surfpool with:

    solana airdrop 10 ADDRESS --url http://127.0.0.1:8899

Do not import a wallet holding real funds into this demo.

## Browser flow

1. Connect the requester wallet and enter four distinct wallet addresses, amount, scope, and acceptance criteria. Creating the agreement exports a versioned JSON terms file.
2. Import that file from the provider wallet; the app checks its canonical SHA-256 against the on-chain commitment before enabling actions.
3. Provider accepts; requester funds; provider submits a file whose SHA-256 is recorded (the file itself stays local); requester approves or disputes.
4. The primary resolver can rule first. After its deadline anyone can advance the dispute to the backup resolver. The backup can release or refund.
5. Anyone can trigger a refund after the delivery deadline, provider release after an undisputed review deadline, or requester refund after the backup deadline. The program prevents duplicate settlement.

The four roles are requester, provider, primary resolver, and backup resolver. Switch accounts in the extension between actions. Deadlines are one day in the UI (the protocol accepts windows from 1 second to 1 year). Timeout transactions require an active caller to submit them, even though they are permissionless. This demo stores agreement roles, terms hash, amount, state, deadlines, and result hash on chain. Scope, criteria, and work evidence are contained in the JSON/local files and shared manually.

## Security and scope notes

This is educational PoC code, not audited or production-ready. The on-chain program enforces authorization and settlement rules; it cannot judge subjective work. Native SOL only, one milestone, no partial awards, revisions, arbitration fees, or agent signing in this first slice. Keep local demo terms synthetic.

Terms are canonicalized before SHA-256 with RFC 8785-compatible key ordering; the terms schema intentionally uses only integer numbers. The browser keeps the JSON and deliverables on the user's machine, but the on-chain commitment and transactions are public to the cluster. The future CLI and agents will use the same protocol-client package.
