#!/bin/sh

set -eu

PORTS="7101 7102 7103 7104"
MAX_ATTEMPTS=60
attempt=1

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
	all_ready=true

	for port in $PORTS; do
		response="$(redis-cli --no-auth-warning -h "$REDIS_PUBLIC_IP" -p "$port" -a "$REDIS_PASSWORD" ping 2> /dev/null || true)"

		if [ "$response" != "PONG" ]; then
			all_ready=false
			break
		fi
	done

	if [ "$all_ready" = true ]; then
		break
	fi

	if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
		echo "Redis cluster nodes did not become ready after $MAX_ATTEMPTS attempts." >&2
		exit 1
	fi

	attempt=$((attempt + 1))
	sleep 1
done

attempt=1

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
	cluster_nodes="$(redis-cli --no-auth-warning -h "$REDIS_PUBLIC_IP" -p 7101 -a "$REDIS_PASSWORD" cluster nodes 2> /dev/null || true)"
	known_nodes="$(printf '%s\n' "$cluster_nodes" | grep -Ec '^[0-9a-f]{40} ' || true)"

	if [ "$known_nodes" -gt 0 ]; then
		break
	fi

	if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
		echo "Redis cluster configuration could not be read after $MAX_ATTEMPTS attempts." >&2
		exit 1
	fi

	attempt=$((attempt + 1))
	sleep 1
done

if [ "$known_nodes" -gt 1 ]; then
	attempt=1

	while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
		if redis-cli --no-auth-warning -h "$REDIS_PUBLIC_IP" -p 7101 -a "$REDIS_PASSWORD" cluster info | grep -q '^cluster_state:ok'; then
			echo "Redis cluster is already initialized."
			exit 0
		fi

		if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
			echo "Redis cluster did not become healthy after $MAX_ATTEMPTS attempts." >&2
			exit 1
		fi

		attempt=$((attempt + 1))
		sleep 1
	done
fi

redis-cli --no-auth-warning -a "$REDIS_PASSWORD" --cluster create \
	"$REDIS_PUBLIC_IP:7101" \
	"$REDIS_PUBLIC_IP:7102" \
	"$REDIS_PUBLIC_IP:7103" \
	"$REDIS_PUBLIC_IP:7104" \
	--cluster-replicas 0 \
	--cluster-yes
