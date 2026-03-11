SHELL := /bin/zsh

.PHONY: run restart

run:
	pnpm run dev

restart:
	./scripts/restart-dev.sh
