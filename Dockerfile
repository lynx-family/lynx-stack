# syntax=docker/dockerfile:1

FROM ubuntu:26.04 AS builder

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# The bundled Linux Lynx runtime currently supports amd64 only.
RUN test "$(dpkg --print-architecture)" = amd64 \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        clang \
        cmake \
        curl \
        git \
        libepoxy0 \
        libexpat1 \
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

COPY .nvmrc rust-toolchain.toml ./

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
RUN mkdir -p /out/native/lib \
    && cp target/x86_64-unknown-linux-gnu/release/ui-judge-server \
        target/x86_64-unknown-linux-gnu/release/lynx-headless-rust-test-runner \
        target/x86_64-unknown-linux-gnu/release/libreact_transform.so \
        target/x86_64-unknown-linux-gnu/release/start.sh \
        target/x86_64-unknown-linux-gnu/release/lynx_core.js /out/native/ \
    && cp target/x86_64-unknown-linux-gnu/release/lib/libLynx_clay.so /out/native/lib/ \
    && strip --strip-unneeded /out/native/ui-judge-server \
        /out/native/lynx-headless-rust-test-runner /out/native/libreact_transform.so

# pnpm prune does not prune an entire workspace. Reinstall production dependencies
# from the populated store, preserving workspace links and generated package files.
RUN find . -type d -name node_modules -prune -exec rm -rf '{}' + \
    && corepack pnpm install --prod --offline --frozen-lockfile --ignore-scripts \
    && find . -type d -name node_modules -prune -o \
        -type d \( -name target -o -name .turbo -o -name .swc \
        -o -name .rslib -o -name .generated \) -prune -exec rm -rf '{}' + \
    && find . -type f \( -name '*.tsbuildinfo' -o -name '*.js.map' \
        -o -name '*.mjs.map' -o -name '*.cjs.map' -o -name '*.css.map' \
        -o -name '*.d.ts.map' \) -delete \
    && rm -rf .github .changeset .vscode .idea .agents

FROM ubuntu:26.04 AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libepoxy0 \
        libexpat1 \
        libgcc-s1 \
        libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# No compiler, package manager, download cache, or builder layers enter this stage.
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /workspace/ ./
COPY --from=builder /out/native/ ./target/x86_64-unknown-linux-gnu/release/

ENV NODE_ENV=production \
    LYNX_LIB_PATH=/workspace/target/x86_64-unknown-linux-gnu/release/lib/libLynx_clay.so \
    LYNX_CORE_JS_PATH=/workspace/target/x86_64-unknown-linux-gnu/release/lynx_core.js \
    PATH=/workspace/target/x86_64-unknown-linux-gnu/release:/workspace/node_modules/.bin:${PATH}

CMD ["/bin/bash"]
