# Permissionless Freelance Escrow

A Solana protocol for clients and freelancers to agree on work, commit milestone
funds, and settle according to rules accepted before work begins. The same
agreements should be usable through a web app, a CLI, and AI agents.

This repository is the project scaffold. The frontend framework and the
protocol's first payment and dispute choices are still to be decided.

## Repository layout

```text
Anchor.toml                   Anchor workspace and local development settings
Cargo.toml                    Rust workspace root
package.json                  JavaScript workspace root
app/web/                      Human-facing web interface
cli/                          Human and agent command-line interface
agents/demo/                  Requester and provider agent demo
packages/protocol-client/     Shared client code and generated Anchor artifacts
programs/freelance_escrow/     Anchor escrow program
tests/program/                Program behavior tests
tests/flows/                  CLI and agent end-to-end flows
scripts/                      Developer environment tooling
docs/                         Architecture and decision records
```

The frontend framework is intentionally undecided. The web app, CLI, and agent
demo should share protocol client code so they use the same instruction and
account definitions. Anchor-generated IDL and TypeScript types are configured
to land under `packages/protocol-client/src/generated/`.

## Development environment

On Arch Linux:

```sh
make bootstrap-arch
```

On Ubuntu:

```sh
make bootstrap-ubuntu
```

Check that the required tools are available with:

```sh
make check
```

The bootstrap installs Rust/Cargo, Solana CLI, Anchor, Surfpool, Node.js, and
Yarn. The Anchor workspace and package directories are scaffolding; program,
app, CLI, and agent dependencies will be added as those components are built.
