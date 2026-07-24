#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
TARGET="x86_64-unknown-linux-gnu"
BINARY="ui-judge-server"
BUILD_TARGET_DIR="${CARGO_TARGET_DIR:-${REPOSITORY_ROOT}/target}"
OUTPUT_DIR="${UI_JUDGE_OUTPUT_DIR:-${SCRIPT_DIR}/dist/linux-amd64}"
LYNX_CORE_SOURCE="${LYNX_CORE_JS_PATH:-${REPOSITORY_ROOT}/packages/lynx/headless-rust-test-runner/fixtures/react/lynx_core.js}"
DEFAULT_LYNX_SDK_DIR="${REPOSITORY_ROOT}/packages/lynx/engine-bridge/target/lynx-engine-bridge-sdk"

cd "${REPOSITORY_ROOT}"

CARGO_TARGET_DIR="${BUILD_TARGET_DIR}" cargo build \
  --locked \
  --release \
  --package ui_judge \
  --features server \
  --bin "${BINARY}" \
  --target "${TARGET}"

BINARY_SOURCE="${BUILD_TARGET_DIR}/${TARGET}/release/${BINARY}"
if [[ -n "${LYNX_LIB_PATH:-}" ]]; then
  LYNX_RUNTIME_SOURCE="${LYNX_LIB_PATH}"
elif [[ -n "${LYNX_SDK_DIR:-}" ]]; then
  LYNX_RUNTIME_SOURCE="${LYNX_SDK_DIR}/lib/libLynx_clay.so"
else
  LYNX_RUNTIME_SOURCE="${DEFAULT_LYNX_SDK_DIR}/lib/libLynx_clay.so"
fi

for required_file in \
  "${BINARY_SOURCE}" \
  "${LYNX_CORE_SOURCE}" \
  "${LYNX_RUNTIME_SOURCE}"; do
  if [[ ! -f "${required_file}" ]]; then
    printf 'Required build artifact not found: %s\n' "${required_file}" >&2
    exit 1
  fi
done

mkdir -p "${OUTPUT_DIR}/lib"
install -m 0755 "${BINARY_SOURCE}" "${OUTPUT_DIR}/${BINARY}"
install -m 0644 "${LYNX_CORE_SOURCE}" "${OUTPUT_DIR}/lynx_core.js"
install -m 0644 "${LYNX_RUNTIME_SOURCE}" "${OUTPUT_DIR}/lib/libLynx_clay.so"

cat > "${OUTPUT_DIR}/start.sh" <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

export LYNX_LIB_PATH="${SCRIPT_DIR}/lib/libLynx_clay.so"
export LYNX_SDK_DIR="${SCRIPT_DIR}"
export LD_LIBRARY_PATH="${SCRIPT_DIR}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
export PORT="${PORT:-8080}"

exec "${SCRIPT_DIR}/ui-judge-server" "$@"
EOF
chmod 0755 "${OUTPUT_DIR}/start.sh"

printf 'Built Linux AMD64 bundle at %s\n' "${OUTPUT_DIR}"
