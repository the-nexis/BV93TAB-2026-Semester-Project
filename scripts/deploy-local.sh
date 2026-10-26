#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.avm/bin:$HOME/.local/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
RPC_URL="http://127.0.0.1:8899"
BUFFER_KEYPAIR="target/deploy/freelance_escrow-upgrade-buffer.json"

node --input-type=module - "$RPC_URL" <<'JS'
const url = process.argv[2];
try {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
  });
  const result = await response.json();
  if (!response.ok || result.result !== "ok") throw new Error("RPC is not healthy");
} catch {
  console.error("Surfpool is not responding at http://127.0.0.1:8899.");
  console.error("Start it in another terminal with: make localnet");
  process.exit(1);
}
JS

wallet="$HOME/.config/solana/freelance-escrow-localnet.json"
wallet_address="$(solana-keygen pubkey "$wallet")"
balance_lamports="$(solana balance "$wallet_address" --lamports --url "$RPC_URL" | awk '{print $1}')"
if [[ "$balance_lamports" =~ ^[0-9]+$ ]] && (( balance_lamports < 5000000000 )); then
  printf 'Funding local deployment wallet with Surfpool SOL: %s\n' "$wallet_address"
  solana airdrop 10 "$wallet_address" --url "$RPC_URL"
fi

# A previous deploy attempt can leave a local buffer keypair behind even when
# no transaction reached Surfpool. Discard it only when its account is absent.
if [[ -f "$BUFFER_KEYPAIR" ]]; then
  buffer_address="$(solana-keygen pubkey "$BUFFER_KEYPAIR")"
  if ! solana account "$buffer_address" --url "$RPC_URL" >/dev/null 2>&1; then
    rm "$BUFFER_KEYPAIR"
    printf 'Removed stale local upgrade buffer %s\n' "$buffer_address"
  fi
fi

anchor deploy --provider.cluster localnet
