# Running a development environment on a remote host

This guide outlines the steps to set up and run a development environment on a remote host. It is aimed to be used mostly for performance benchmarking. The environment consists of three parts: Redis, API, and Probes. For every part there is a bash script which prepares and runs everything. Every script is executed on a separate Ubuntu server.

## Redis

```bash
# Make sure port 6379 is open
# Update that variables before start
REDIS_PASSWORD=<your_value>
REDIS_MAX_MEMORY=500mb

# Install docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Allow to run docker without sudo
sudo sh -eux <<EOF
# Install newuidmap & newgidmap binaries
apt-get install -y uidmap
EOF
dockerd-rootless-setuptool.sh install

# Copy and enter the repository
git clone https://github.com/jsdelivr/globalping.git
cd globalping/

# Add redis config lines
echo "requirepass $REDIS_PASSWORD" >> redis.conf
echo "maxmemory $REDIS_MAX_MEMORY" >> redis.conf

# Start docker compose
docker compose up -d
```

## API

```bash
# Here we are running 2 API instances on ports 3001 and 3002 behind the haproxy on port 80
# Update that variables before start
REDIS_PASSWORD=<your_value>
REDIS_HOST=<your_value>

# Install haproxy
sudo apt-get update
sudo apt -y install haproxy

# Configure and start haproxy
sudo chmod a+w /etc/haproxy/haproxy.cfg
cat <<EOF | sudo tee -a /etc/haproxy/haproxy.cfg > /dev/null
frontend gp_fe
    bind *:80
    default_backend gp_be

backend gp_be
    balance roundrobin
    option httpchk GET /health
    server server1 127.0.0.1:3001 check
    server server2 127.0.0.1:3002 check
EOF
sudo systemctl stop haproxy
sudo systemctl start haproxy

# Install node
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=18
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update
sudo apt-get install nodejs -y

# Copy and build the repository
git clone https://github.com/jsdelivr/globalping.git
cd globalping/
npm i
npm run build

# Run the app
echo "Run 2 app instances using:
PORT=3001 REDIS_URL=redis://:$REDIS_PASSWORD@$REDIS_HOST:6379 NODE_ENV=production FAKE_PROBE_IP=probe NEW_RELIC_ENABLED=false NEW_RELIC_LOG_ENABLED=false node dist/index.js
and
PORT=3002 REDIS_URL=redis://:$REDIS_PASSWORD@$REDIS_HOST:6379 NODE_ENV=production FAKE_PROBE_IP=probe NEW_RELIC_ENABLED=false NEW_RELIC_LOG_ENABLED=false node dist/index.js
"
```

## Probe

```bash
# Update that variables before start
API_HOST=<your_value>

# Install node
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=18
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update
sudo apt-get install nodejs -y

# Copy and build the repository
git clone https://github.com/jsdelivr/globalping-probe.git
cd globalping-probe
npm i
npm run build

# Update the configuration
sed -i "s|'ws://localhost:3000'|'ws://$API_HOST'|" config/development.cjs

# Run the probes
FAKE_PROBE_IP=1 NODE_ENV=development node dist/index.js
```
