# Architecture: local vertical slice

The first slice is a single-milestone SOL escrow. programs/freelance_escrow owns a PDA vault and agreement account. packages/protocol-client contains the Anchor Core/web3.js boundary, PDA derivation, and versioned terms hashing. app/web is a React + Vite client that signs through a browser wallet. Anchor integration tests run against Surfpool's embedded local runtime.

The public agreement commits roles, amount, terms hash, current status, active deadlines, and submitted result hash. The JSON terms and files remain local and are exchanged manually. Both sides hash the RFC 8785 canonical form of the same terms before acting. The protocol uses a requester, provider, primary resolver, and backup resolver. Settlement is all-or-nothing.

State progression:

    Proposed -> Accepted -> Funded -> Submitted -> Settled
                                      |       -> Disputed -> Settled or Refunded
                                      |                      -> backup timeout refund
                                      -> delivery timeout refund
                         review timeout -> Settled

The resolver result is a policy choice accepted before funding. Either the primary or backup can settle only during its assigned stage and deadline. If a resolver goes silent, the next stage becomes eligible after a timeout; if the backup also goes silent, anyone may trigger a requester refund. Terminal accounts can be closed by the requester to recover rent reserves.

## Local operations

make localnet starts Surfpool offline without deploying programs. make build generates the local program keypair if needed, synchronizes the local program ID, and builds. make deploy-local deploys to the running Surfpool. make test uses the embedded Surfpool SDK for isolated state and clock control. The browser app uses Surfpool RPC and a browser extension wallet.

The local deploy keypair and demo wallet are machine-local and ignored; the setup helper uses a dedicated path and does not replace an existing file. No public RPC or real SOL is part of the local acceptance path.

## Follow-on boundary

The CLI and requester/provider agents are still in scope for the broader product, but follow the browser vertical slice. Both should call this shared client and operate on identical agreements. The agent phase includes a Codex SDK sign-in feasibility spike before choosing an execution harness.
