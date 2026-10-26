#!/usr/bin/env bash
set -euo pipefail

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

# The bundled installer may leave Anchor uninstalled or inactive. Install it
# explicitly through Anchor Version Manager, the recommended Anchor workflow.
if ! command -v anchor >/dev/null 2>&1; then
  if ! command -v avm >/dev/null 2>&1; then
    cargo install --git https://github.com/otter-sec/anchor avm --force
  fi
  avm install latest
  avm use latest
fi

# GNU Make adds these directories for subsequent checks even if the current
# interactive shell has not reloaded its startup configuration.
make check
