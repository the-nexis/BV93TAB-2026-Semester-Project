#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.avm/bin:$HOME/.local/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

wallet="$HOME/.config/solana/freelance-escrow-localnet.json"
program_key="target/deploy/freelance_escrow-keypair.json"
mkdir -p "$(dirname "$wallet")" target/deploy
if [[ ! -f "$wallet" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$wallet"
  chmod 600 "$wallet"
fi
if [[ ! -f "$program_key" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$program_key"
fi
program_id="$(solana-keygen pubkey "$program_key")"
python3 - "$program_id" <<'PY'
import pathlib, re, sys
program_id = sys.argv[1]
anchor = pathlib.Path("Anchor.toml")
source = pathlib.Path("programs/freelance_escrow/src/lib.rs")
a = anchor.read_text()
a, n = re.subn(r'(?m)^(freelance_escrow\s*=\s*)"[1-9A-HJ-NP-Za-km-z]+"$', rf'\g<1>"{program_id}"', a, count=1)
if n != 1:
    raise SystemExit("Could not update [programs.localnet] in Anchor.toml")
anchor.write_text(a)
s = source.read_text()
s, n = re.subn(r'declare_id!\("[1-9A-HJ-NP-Za-km-z]+"\);', f'declare_id!("{program_id}");', s, count=1)
if n != 1:
    raise SystemExit("Could not update declare_id! in program source")
source.write_text(s)
PY
anchor keys sync
printf 'Local wallet: %s\nProgram ID: %s\n' "$(solana-keygen pubkey "$wallet")" "$program_id"
printf 'Wallet path: %s\n' "$wallet"
