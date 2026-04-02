FROM redis/redis-stack-server:7.4.0-v1

ARG TARGETARCH

USER root

RUN mkdir -p /opt/redis-modules

COPY config/redis/modules/redis-compressed-linux-amd64.so /tmp/redis-compressed-linux-amd64.so
COPY config/redis/modules/redis-compressed-linux-arm64.so /tmp/redis-compressed-linux-arm64.so

RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) cp /tmp/redis-compressed-linux-amd64.so /opt/redis-modules/redis-compressed.so ;; \
      arm64) cp /tmp/redis-compressed-linux-arm64.so /opt/redis-modules/redis-compressed.so ;; \
      *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    rm /tmp/redis-compressed-linux-amd64.so /tmp/redis-compressed-linux-arm64.so

USER root
