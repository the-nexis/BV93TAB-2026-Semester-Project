# Decision 0001: local browser vertical slice

Status: accepted

Start with a local browser flow using React, TypeScript, Vite, Anchor Core, Wallet Adapter, Surfpool, and native SOL. Keep the broader CLI and agent scope as follow-on work. This reduces integration risk while establishing one shared protocol and a real settlement path early.

The first protocol supports one milestone and full release/full refund. Terms are versioned JSON, exchanged manually, and committed on chain with a canonical SHA-256 hash. The protocol enforces explicit deadlines and primary to backup resolver handoff. It does not claim to resolve subjective quality.
