# syntax=docker/dockerfile:1

FROM --platform=linux/amd64 ubuntu:26.04@sha256:2260313b31c8c011cd2eebe728008efac1b3982be73eb71348ea2648d2c0e09b

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
    libepoxy0 \
    libexpat1 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir --parents /tmp/ui-judge \
  && chmod 1777 /tmp/ui-judge

WORKDIR /opt/ui-judge
COPY ui-judge-server start.sh lynx_core.js ./
COPY lib/libLynx_clay.so ./lib/libLynx_clay.so

ENV LYNX_USE_PORT=8080 \
    TMPDIR=/tmp/ui-judge

EXPOSE 8080
STOPSIGNAL SIGTERM

USER 65532:65532

ENTRYPOINT ["./start.sh"]
