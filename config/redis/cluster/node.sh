#!/usr/bin/dumb-init /bin/sh

PORT=$1

SRC_CONF_FILE="/home/runner/mounted/node.conf"
DST_CONF_FILE="/node.conf"

# copy the base config
cp $SRC_CONF_FILE $DST_CONF_FILE

# add node-specific values
echo "
port ${PORT}
cluster-announce-ip $REDIS_PUBLIC_IP
cluster-config-file node-cluster-config.conf
requirepass $REDIS_PASSWORD
masterauth $REDIS_PASSWORD" >> $DST_CONF_FILE

# start the server
cd /data
exec redis-server $DST_CONF_FILE
