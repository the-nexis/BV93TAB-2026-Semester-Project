.PHONY: bootstrap-arch bootstrap-ubuntu check

REQUIRED_TOOLS := rustc cargo solana anchor surfpool node yarn

# The official installer places Solana and Anchor in user-local directories.
# Add them for Make recipes even before the user restarts their shell.
export PATH := $(HOME)/.cargo/bin:$(HOME)/.avm/bin:$(HOME)/.local/bin:$(HOME)/.local/share/solana/install/active_release/bin:$(PATH)

check:
	@missing=0; \
	for tool in $(REQUIRED_TOOLS); do \
		if command -v "$$tool" >/dev/null 2>&1; then \
			printf 'OK      %s (%s)\n' "$$tool" "$$(command -v "$$tool")"; \
		else \
			printf 'MISSING %s\n' "$$tool"; \
			missing=1; \
		fi; \
	done; \
	if [ "$$missing" -ne 0 ]; then \
		printf '\nRun `make bootstrap-arch` (Arch Linux) or `make bootstrap-ubuntu` (Ubuntu) to install the toolchain.\n'; \
		exit 1; \
	fi

bootstrap-arch:
	@if [ ! -f /etc/arch-release ]; then \
		printf 'This target is for Arch Linux.\n' >&2; \
		exit 1; \
	fi
	@command -v pacman >/dev/null 2>&1 || { printf 'pacman is required.\n' >&2; exit 1; }
	@command -v sudo >/dev/null 2>&1 || { printf 'sudo is required to install Arch packages.\n' >&2; exit 1; }
	sudo pacman -S --needed --noconfirm base-devel curl git
	@bash scripts/bootstrap-toolchain.sh

bootstrap-ubuntu:
	@if [ ! -f /etc/lsb-release ] && ! grep -q '^ID=ubuntu$$' /etc/os-release 2>/dev/null; then \
		printf 'This target is for Ubuntu.\n' >&2; \
		exit 1; \
	fi
	@command -v apt-get >/dev/null 2>&1 || { printf 'apt-get is required.\n' >&2; exit 1; }
	@command -v sudo >/dev/null 2>&1 || { printf 'sudo is required to install Ubuntu packages.\n' >&2; exit 1; }
	sudo apt-get update
	sudo apt-get install -y build-essential pkg-config libssl-dev curl git
	@bash scripts/bootstrap-toolchain.sh
