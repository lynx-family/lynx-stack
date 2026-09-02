# syntax=docker/dockerfile:1

# The downloaded Lynx runtime currently supports Linux AMD64 only. Use the
# repository root as the build context so Cargo can resolve workspace crates.
ARG RUST_VERSION=1.97.1

FROM --platform=linux/amd64 rust:${RUST_VERSION}-bookworm AS builder

WORKDIR /workspace
COPY . .

RUN packages/genui/ui-judge/build.sh

FROM --platform=linux/amd64 debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
    libepoxy0 \
    libexpat1 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir --parents /tmp/ui-judge \
  && chmod 1777 /tmp/ui-judge

COPY --from=builder /workspace/packages/genui/ui-judge/dist/linux-amd64/ /opt/ui-judge/

ENV LYNX_USE_PORT=8080 \
    TMPDIR=/tmp/ui-judge

EXPOSE 8080
STOPSIGNAL SIGTERM

USER 65532:65532

ENTRYPOINT ["/opt/ui-judge/start.sh"]
