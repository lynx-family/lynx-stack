#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ENTRY="${SCRIPT_DIR}/dist/index.js"

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js 22 or 24 is required to start the GenUI server.\n' >&2
  exit 1
fi

NODE_MAJOR="$(node --eval 'process.stdout.write(process.versions.node.split(".")[0])')"
case "${NODE_MAJOR}" in
  22 | 24)
    ;;
  *)
    printf \
      'Unsupported Node.js major version: %s. Use Node.js 22 or 24.\n' \
      "${NODE_MAJOR}" >&2
    exit 1
    ;;
esac

if [[ ! -f "${SERVER_ENTRY}" ]]; then
  printf 'GenUI server build artifact not found: %s\n' "${SERVER_ENTRY}" >&2
  printf 'Run pnpm turbo build from the repository root before starting the server.\n' >&2
  exit 1
fi

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"

cd "${SCRIPT_DIR}"
exec node "${SERVER_ENTRY}" "$@"
