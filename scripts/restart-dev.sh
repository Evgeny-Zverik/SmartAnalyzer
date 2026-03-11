#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORTS=(3000 8000)

for port in "${PORTS[@]}"; do
  pids_text="$(lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids_text}" ]]; then
    pids=("${(@f)pids_text}")
    echo "Killing listeners on port ${port}: ${pids[*]}"
    kill "${pids[@]}" 2>/dev/null || true
  fi
done

sleep 1

for port in "${PORTS[@]}"; do
  pids_text="$(lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids_text}" ]]; then
    pids=("${(@f)pids_text}")
    echo "Force killing listeners on port ${port}: ${pids[*]}"
    kill -9 "${pids[@]}" 2>/dev/null || true
  fi
done

cd "${ROOT_DIR}"
exec make run
