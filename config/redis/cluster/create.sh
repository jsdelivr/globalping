#!/bin/sh

set -eu

PORT_1="${REDIS_CLUSTER_NODE_1_PORT:-7101}"
PORT_2="${REDIS_CLUSTER_NODE_2_PORT:-7102}"
PORT_3="${REDIS_CLUSTER_NODE_3_PORT:-7103}"
PORT_4="${REDIS_CLUSTER_NODE_4_PORT:-7104}"
PORTS="$PORT_1 $PORT_2 $PORT_3 $PORT_4"
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
	cluster_nodes="$(redis-cli --no-auth-warning -h "$REDIS_PUBLIC_IP" -p "$PORT_1" -a "$REDIS_PASSWORD" cluster nodes 2> /dev/null || true)"
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
		if redis-cli --no-auth-warning -h "$REDIS_PUBLIC_IP" -p "$PORT_1" -a "$REDIS_PASSWORD" cluster info | grep -q '^cluster_state:ok'; then
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
	"$REDIS_PUBLIC_IP:$PORT_1" \
	"$REDIS_PUBLIC_IP:$PORT_2" \
	"$REDIS_PUBLIC_IP:$PORT_3" \
	"$REDIS_PUBLIC_IP:$PORT_4" \
	--cluster-replicas 0 \
	--cluster-yes
