# Protocol client

Shared client layer for the web app, CLI, and agent demo. It contains the Anchor
Core boundary, PDA derivation, terms schema validation, RFC 8785-compatible
canonicalization, SHA-256, and terms export helpers.

Anchor-generated IDL and types are written to `src/generated/` by `anchor build`.
The web app, CLI, and agents should all consume this package rather than spread
web3.js v1 details into their own code.
