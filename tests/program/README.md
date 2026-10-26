# Program integration tests

make test builds the Anchor program and runs tests/program/escrow.ts against an embedded Surfpool instance. The suite checks hash mismatch, unauthorized acceptance, delivery refund, review release, primary-to-backup handoff, backup resolution, final timeout refund, and duplicate settlement rejection.
