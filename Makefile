.PHONY: bootstrap-arch bootstrap-ubuntu check export install init-local build deploy-local check-localnet localnet test web

REQUIRED_TOOLS := rustc cargo solana anchor surfpool node yarn
export PATH := $(HOME)/.cargo/bin:$(HOME)/.avm/bin:$(HOME)/.local/bin:$(HOME)/.local/share/solana/install/active_release/bin:$(PATH)

check:
	@missing=0; for tool in $(REQUIRED_TOOLS); do if command -v "$$tool" >/dev/null 2>&1; then printf 'OK      %s (%s)\n' "$$tool" "$$(command -v "$$tool")"; else printf 'MISSING %s\n' "$$tool"; missing=1; fi; done; \
	if command -v anchor >/dev/null 2>&1; then anchor_dir="$$(dirname "$$(readlink -f "$$(command -v anchor)")")"; if [ -x "$$anchor_dir/anchor-1.2.1" ] && "$$anchor_dir/anchor-1.2.1" --version | grep -Fq '1.2.1'; then :; else printf 'WRONG   anchor (expected AVM-managed 1.2.1)\n'; missing=1; fi; fi; \
	if command -v solana >/dev/null 2>&1 && ! solana --version | grep -Fq '4.1.2'; then printf 'WRONG   solana (expected 4.1.2)\n'; missing=1; fi; \
	if [ $$missing -ne 0 ]; then printf '\nRun make bootstrap-arch or make bootstrap-ubuntu to install the toolchain.\n'; exit 1; fi

# A child process cannot modify its parent shell; eval the emitted assignment to apply it.
export:
	@printf 'export PATH="%s"\n' "$(PATH)"

install:
	yarn install --frozen-lockfile

init-local:
	bash scripts/prepare-local.sh

build: init-local
	anchor build


check-localnet:
	bash scripts/check-localnet.sh

deploy-local: check-localnet build
	bash scripts/deploy-local.sh

localnet: init-local
	surfpool start --offline --no-deploy --no-tui --no-studio \
		--airdrop-keypair-path "$(HOME)/.config/solana/freelance-escrow-localnet.json" \
		--airdrop-amount 10000000000

test: build
	yarn test:program

web: build
	yarn workspace @freelance-escrow/web dev

bootstrap-arch:
	@if [ ! -f /etc/arch-release ]; then printf 'This target is for Arch Linux.\n' >&2; exit 1; fi
	@command -v pacman >/dev/null 2>&1 || { printf 'pacman is required.\n' >&2; exit 1; }
	@command -v sudo >/dev/null 2>&1 || { printf 'sudo is required to install Arch packages.\n' >&2; exit 1; }
	sudo pacman -S --needed --noconfirm base-devel curl git
	@bash scripts/bootstrap-toolchain.sh

bootstrap-ubuntu:
	@if [ ! -f /etc/lsb-release ] && ! grep -q '^ID=ubuntu$$' /etc/os-release 2>/dev/null; then printf 'This target is for Ubuntu.\n' >&2; exit 1; fi
	@command -v apt-get >/dev/null 2>&1 || { printf 'apt-get is required.\n' >&2; exit 1; }
	@command -v sudo >/dev/null 2>&1 || { printf 'sudo is required to install Ubuntu packages.\n' >&2; exit 1; }
	sudo apt-get update
	sudo apt-get install -y build-essential pkg-config libssl-dev curl git
	@bash scripts/bootstrap-toolchain.sh
