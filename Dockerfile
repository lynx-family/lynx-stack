# syntax=docker/dockerfile:1

FROM ubuntu:26.04 AS base

ARG UBUNTU_MIRROR

# Share runtime libraries and the optional APT mirror across both stages.
RUN if [ -n "$UBUNTU_MIRROR" ]; then \
        sed -i -E "s#http://(archive|security)[.]ubuntu[.]com/ubuntu#$UBUNTU_MIRROR#g" \
            /etc/apt/sources.list.d/ubuntu.sources; \
    fi \
    && apt-get update --error-on=any \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libepoxy0 \
        libexpat1 \
        libgcc-s1 \
        libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# The bundled Linux Lynx runtime currently supports amd64 only.
RUN test "$(dpkg --print-architecture)" = amd64 \
    && apt-get update --error-on=any \
    && apt-get install -y --no-install-recommends \
        build-essential \
        clang \
        cmake \
        curl \
        git \
        pkg-config \
        python3 \
        unzip \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

ENV CI=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HUSKY=0 \
    TURBO_TELEMETRY_DISABLED=1 \
    PATH=/root/.cargo/bin:${PATH}

WORKDIR /workspace

COPY .nvmrc ./

# Use the repository's Node pin and verify the official distribution checksum.
RUN node_version="$(cat .nvmrc)" \
    && archive="node-${node_version}-linux-x64.tar.xz" \
    && curl -fsSL --retry 3 "https://nodejs.org/dist/${node_version}/${archive}" -o "/tmp/${archive}" \
    && curl -fsSL --retry 3 "https://nodejs.org/dist/${node_version}/SHASUMS256.txt" -o /tmp/SHASUMS256.txt \
    && (cd /tmp && grep " ${archive}$" SHASUMS256.txt | sha256sum --check -) \
    && tar -xJf "/tmp/${archive}" -C /usr/local --strip-components=1 \
    && rm "/tmp/${archive}" /tmp/SHASUMS256.txt \
    && npm install --global corepack@0.35.0 \
    && corepack enable

# Use Rust's default directories: Turbo filters custom CARGO_HOME/RUSTUP_HOME.
# rustup reads the pinned toolchain and Wasm targets from rust-toolchain.toml.
COPY rust-toolchain.toml ./
RUN curl -fsSL --retry 3 https://sh.rustup.rs -o /tmp/rustup-init.sh \
    && sh /tmp/rustup-init.sh -y --no-modify-path --default-toolchain none \
    && rustup show \
    && rm /tmp/rustup-init.sh

COPY . .

RUN corepack pnpm install --frozen-lockfile

# Match deploy-main.yml. Wasm packages are built through their Turbo tasks.
RUN corepack pnpm turbo build \
    --filter '!benchx_cli' \
    --filter '!@lynx-js/benchmark-*' \
    --summarize

# These three crates ship Wasm artifacts, not native shared libraries.
# Enable the optional HTTP binary as well as the headless runner.
RUN cargo build --workspace --locked --release \
    --target x86_64-unknown-linux-gnu \
    --exclude swc_plugin_reactlynx \
    --exclude swc_plugin_reactlynx_compat \
    --exclude web-core \
    --features ui_judge/server

# Export only native deliverables before removing every Cargo target directory.
RUN mkdir -p /out/native /out/sdk/lib \
    && cd target/x86_64-unknown-linux-gnu/release \
    && cp ui-judge-server lynx-headless-rust-test-runner libreact_transform.so start.sh /out/native/ \
    && cp lynx_core.js /out/sdk/ \
    && cp lib/libLynx_clay.so /out/sdk/lib/ \
    && strip --strip-unneeded /out/native/ui-judge-server \
        /out/native/lynx-headless-rust-test-runner /out/native/libreact_transform.so

# pnpm prune does not prune an entire workspace. Reinstall production dependencies
# using cached packages when available, fetching any missing package snapshots.
# Preserve workspace links and generated package files.
RUN find . -type d -name node_modules -prune -exec rm -rf '{}' + \
    && corepack pnpm install --prod --prefer-offline --frozen-lockfile --ignore-scripts \
    && find . -type d -name node_modules -prune -o \
        -type d \( -name target -o -name .turbo -o -name .swc \
        -o -name .rslib -o -name .generated \) -prune -exec rm -rf '{}' + \
    && find . -type f \( -name '*.tsbuildinfo' -o -name '*.js.map' \
        -o -name '*.mjs.map' -o -name '*.cjs.map' -o -name '*.css.map' \
        -o -name '*.d.ts.map' \) -delete \
    && rm -rf .github .changeset .vscode .idea .agents .volcengine

# Keep dependency paths and workspace symlinks intact when splitting the layers.
# Install bookkeeping and timestamps must not give unchanged dependencies a new digest.
RUN mkdir -p /out/dependencies \
    && find . -type d -name node_modules -prune -print0 > /tmp/runtime-node-modules \
    && while IFS= read -r -d '' modules; do \
        mkdir -p "/out/dependencies/$(dirname "$modules")" \
            && mv "$modules" "/out/dependencies/$modules" || exit 1; \
    done < /tmp/runtime-node-modules \
    && rm /tmp/runtime-node-modules \
    && rm -rf /out/dependencies/node_modules/.cache \
        /out/dependencies/node_modules/.pnpm-store \
    && rm -f /out/dependencies/node_modules/.modules.yaml \
        /out/dependencies/node_modules/.pnpm-workspace-state-v1.json \
    && TZ=UTC find /out/dependencies /out/sdk /out/native /workspace \
        -exec touch -h -t 197001010000.00 '{}' +

FROM base AS runtime

WORKDIR /workspace

# No compiler, package manager, download cache, or builder layers enter this stage.
COPY --link --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --link --from=builder /out/dependencies/ ./
COPY --link --from=builder /out/sdk/ ./target/x86_64-unknown-linux-gnu/release/
COPY --link --from=builder /workspace/ ./
COPY --link --from=builder /out/native/ ./target/x86_64-unknown-linux-gnu/release/

ENV NODE_ENV=production \
    LYNX_LIB_PATH=/workspace/target/x86_64-unknown-linux-gnu/release/lib/libLynx_clay.so \
    LYNX_CORE_JS_PATH=/workspace/target/x86_64-unknown-linux-gnu/release/lynx_core.js \
    PATH=/workspace/target/x86_64-unknown-linux-gnu/release:/workspace/node_modules/.bin:${PATH}

CMD ["/bin/bash"]
