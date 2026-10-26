# Architecture overview

## Components

- `programs/` owns agreement state, escrow custody, authorization, and settlement
  rules.
- `packages/protocol-client/` is the shared interface to program instructions
  and accounts. Anchor-generated IDL and types are placed under its `src/generated/`
  directory.
- `app/web/` provides the human-facing interface.
- `cli/` provides the machine-readable command-line interface used by people
  and agents.
- `agents/demo/` contains the requester/provider agent demonstration. Agents
  use the same protocol and CLI surfaces; they do not get special program
  privileges by virtue of being agents.
- `tests/program/` covers program rules. `tests/flows/` covers complete CLI and
  agent workflows.

## Deliberately open decisions

- Frontend framework and wallet connection approach.
- Payment asset and escrow account design.
- Agreement and milestone state transitions.
- Dispute resolver interface and timeout outcomes.
- Agent runtime, model provider, and signing policy.
- Storage and sharing model for private briefs and deliverable evidence.

Resolve these in decision records under `docs/decisions/` before they become
cross-component assumptions.
