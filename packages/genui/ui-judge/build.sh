#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
TARGET="x86_64-unknown-linux-gnu"
BINARY="ui-judge-server"
BUILD_TARGET_DIR="${CARGO_TARGET_DIR:-${REPOSITORY_ROOT}/target}"
OUTPUT_DIR="${UI_JUDGE_OUTPUT_DIR:-${SCRIPT_DIR}/dist/linux-amd64}"

cd "${REPOSITORY_ROOT}"

CARGO_TARGET_DIR="${BUILD_TARGET_DIR}" cargo build \
  --locked \
  --release \
  --package ui_judge \
  --features server \
  --bin "${BINARY}" \
  --target "${TARGET}"

BINARY_SOURCE="${BUILD_TARGET_DIR}/${TARGET}/release/${BINARY}"
START_SCRIPT_SOURCE="${BUILD_TARGET_DIR}/${TARGET}/release/start.sh"
LYNX_CORE_SOURCE="${BUILD_TARGET_DIR}/${TARGET}/release/lynx_core.js"
LYNX_RUNTIME_SOURCE="${BUILD_TARGET_DIR}/${TARGET}/release/lib/libLynx_clay.so"

for required_file in \
  "${BINARY_SOURCE}" \
  "${START_SCRIPT_SOURCE}" \
  "${LYNX_CORE_SOURCE}" \
  "${LYNX_RUNTIME_SOURCE}"; do
  if [[ ! -f "${required_file}" ]]; then
    printf 'Required build artifact not found: %s\n' "${required_file}" >&2
    exit 1
  fi
done

mkdir -p "${OUTPUT_DIR}/lib"
install -m 0755 "${BINARY_SOURCE}" "${OUTPUT_DIR}/${BINARY}"
install -m 0755 "${START_SCRIPT_SOURCE}" "${OUTPUT_DIR}/start.sh"
install -m 0644 "${LYNX_CORE_SOURCE}" "${OUTPUT_DIR}/lynx_core.js"
install -m 0644 "${LYNX_RUNTIME_SOURCE}" "${OUTPUT_DIR}/lib/libLynx_clay.so"

printf 'Built Linux AMD64 bundle at %s\n' "${OUTPUT_DIR}"
