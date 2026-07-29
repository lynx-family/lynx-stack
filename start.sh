#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ENTRY="${SCRIPT_DIR}/packages/genui/server/dist/index.js"

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
  printf 'Run ./build.sh before starting the server.\n' >&2
  exit 1
fi

if [[ "${REQUIRE_HTTP_MESH:-False}" == "True" ]]; then
  if [[ -z "${MESH_INGRESS_PORT:-}" ]]; then
    printf \
      'MESH_INGRESS_PORT is required when REQUIRE_HTTP_MESH=True.\n' >&2
    exit 1
  fi
  export LYNX_USE_HOST="127.0.0.1"
  export LYNX_USE_PORT="${MESH_INGRESS_PORT}"
else
  export LYNX_USE_HOST="${LYNX_USE_HOST:-${HOST:-0.0.0.0}}"
  export LYNX_USE_PORT="${LYNX_USE_PORT:-${PORT:-3000}}"
fi

cd "${SCRIPT_DIR}"
exec node "${SERVER_ENTRY}" "$@"
