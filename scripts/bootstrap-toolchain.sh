#!/usr/bin/env bash
set -euo pipefail

ANCHOR_VERSION="1.2.1"
SOLANA_VERSION="4.1.2"

# Make user-local installs available before checking or installing anything.
export PATH="$HOME/.cargo/bin:$HOME/.avm/bin:$HOME/.local/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Use Solana's official installer for the base development toolchain if any
# of its non-Anchor tools are missing.
if ! command -v rustc >/dev/null 2>&1 \
  || ! command -v cargo >/dev/null 2>&1 \
  || ! command -v solana >/dev/null 2>&1 \
  || ! command -v surfpool >/dev/null 2>&1 \
  || ! command -v node >/dev/null 2>&1 \
  || ! command -v yarn >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
fi

# Select the Solana version paired with this repository's Anchor version.
if ! command -v solana >/dev/null 2>&1 || ! solana --version | grep -Fq "$SOLANA_VERSION"; then
  sh -c "$(curl --proto '=https' --tlsv1.2 -sSfL "https://release.anza.xyz/v${SOLANA_VERSION}/install")"
fi

# AVM keeps Anchor CLI versions separate so the workspace can reproduce the
# toolchain specified in Anchor.toml.
if ! command -v avm >/dev/null 2>&1; then
  cargo install --git https://github.com/otter-sec/anchor avm --force
fi
if [[ ! -x "$HOME/.avm/bin/anchor-$ANCHOR_VERSION" ]]; then
  avm install "$ANCHOR_VERSION"
fi
avm use "$ANCHOR_VERSION"

# GNU Make adds these directories for subsequent checks even if the current
# interactive shell has not reloaded its startup configuration.
make check
