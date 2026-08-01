# syntax=docker/dockerfile:1

# Use the repository root as the build context so Cargo can resolve the
# workspace-local Lynx crates.
ARG RUST_VERSION=1.92.0

FROM --platform=linux/amd64 rust:${RUST_VERSION}-bookworm AS builder

WORKDIR /workspace
COPY . .

RUN cargo build --locked --release -p ui_judge --features server --bin ui-judge-server
RUN test -x /workspace/target/release/ui-judge-server
RUN test -s /workspace/packages/lynx/engine-bridge/target/lynx-engine-bridge-sdk/lib/libLynx_clay.so

FROM --platform=linux/amd64 debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
    libepoxy0 \
    libexpat1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/target/release/ui-judge-server /usr/local/bin/ui-judge-server
COPY --from=builder /workspace/packages/lynx/headless-rust-test-runner/fixtures/react/lynx_core.js /usr/local/bin/lynx_core.js
COPY --from=builder /workspace/packages/lynx/engine-bridge/target/lynx-engine-bridge-sdk/lib/libLynx_clay.so /opt/lynx-sdk/lib/libLynx_clay.so

ENV LYNX_SDK_DIR=/opt/lynx-sdk \
    PORT=8080

EXPOSE 8080
STOPSIGNAL SIGTERM

# The server only needs read access to its binary and runtime assets.
USER 65532:65532

ENTRYPOINT ["/usr/local/bin/ui-judge-server"]
