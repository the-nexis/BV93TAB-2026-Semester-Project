# Freelance escrow program

Anchor program for one-milestone native SOL escrow. Agreement state and an
associated program-owned vault are PDAs. Public state contains the participant
roles, amount, terms hash, lifecycle status, deadlines, and submitted result
hash. Full release and full refund are the only settlement outcomes.

Build through `make build`; the generated program ID is local to each checkout
unless the project team later agrees on a shared ID. Run integration tests with
`make test`.
