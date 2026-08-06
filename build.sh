#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

export CI="${CI:-1}"
export TURBO_TELEMETRY_DISABLED="${TURBO_TELEMETRY_DISABLED:-1}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=32768}"

if ! command -v corepack >/dev/null 2>&1; then
  printf 'corepack is required to use the pnpm version pinned by package.json.\n' >&2
  exit 1
fi

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  corepack pnpm install --frozen-lockfile
fi

corepack pnpm turbo build --summarize
