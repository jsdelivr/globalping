# Running a remote staging environment

This guide outlines the steps to set up and run a staging environment on a remote host. It is aimed to be used mostly for performance benchmarking. The environment consists of three parts: Redis, API, and Probes. For every part there is a bash script which prepares and runs everything. Every script is executed on a separate Ubuntu server.

## Redis

Starts a redis db inside docker. Make sure port 6379 is open for connections.

```bash
# Update that variables before start
REDIS_PASSWORD=<your_value>
REDIS_MAX_MEMORY=500mb

# Copy and enter the repository
git clone https://github.com/jsdelivr/globalping.git
cd globalping/

# Add redis config lines
echo "requirepass $REDIS_PASSWORD" >> redis.conf
echo "maxmemory $REDIS_MAX_MEMORY" >> redis.conf

# Install docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Allow to run docker without sudo
sudo su -c "sudo usermod -aG docker ubuntu && exit" -

# Relogin and start
echo "Need to relogin, please get back and run:
cd globalping/ && docker compose up -d
"
exit
```

## API

Runs 2 API instances on ports 3001 and 3002 behind the haproxy on port 80. Geoip client is mocked so all probes get same location. `FAKE_PROBE_IP=probe` makes API to use fake ip provided by the probe.

```bash
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
echo 'Run 2 app instances using:
PORT=3001 HOSTNAME=3001 REDIS_URL=redis://default:$REDIS_PASSWORD@$REDIS_HOST:6379 NODE_ENV=production ADMIN_KEY=admin FAKE_PROBE_IP=probe NEW_RELIC_ENABLED=false NEW_RELIC_LOG_ENABLED=false node dist/index.js
and
PORT=3002 HOSTNAME=3002 REDIS_URL=redis://default:$REDIS_PASSWORD@$REDIS_HOST:6379 NODE_ENV=production ADMIN_KEY=admin FAKE_PROBE_IP=probe NEW_RELIC_ENABLED=false NEW_RELIC_LOG_ENABLED=false node dist/index.js
'
```

## Probe

Runs `PROBES_COUNT` number of probe processes. They all get a random fake ip which is passed to the API. Value of the `FAKE_PROBE_IP` is the first octet of the fake ip. Each probe process requires ~40mb of RAM.

```bash
# Update that variables before start
API_HOST=<your_value>
FAKE_PROBE_IP=1
PROBES_COUNT=300

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

# Install unbuffer
ARCHLOCAL=$(dpkg --print-architecture)
curl "http://ftp.nl.debian.org/debian/pool/main/e/expect/tcl-expect_5.45.4-2+b1_${ARCHLOCAL}.deb" -o "/tmp/tcl-expect.deb"
sudo dpkg --extract "/tmp/tcl-expect.deb" /
curl "http://ftp.nl.debian.org/debian/pool/main/t/tcl8.6/libtcl8.6_8.6.11+dfsg-1_${ARCHLOCAL}.deb" -o "/tmp/libtcl.deb"
sudo dpkg --extract "/tmp/libtcl.deb" /
curl "http://ftp.nl.debian.org/debian/pool/main/t/tcl8.6/tcl8.6_8.6.11+dfsg-1_${ARCHLOCAL}.deb" -o "/tmp/tcl.deb"
sudo dpkg --extract "/tmp/tcl.deb" /
curl "http://ftp.nl.debian.org/debian/pool/main/e/expect/expect_5.45.4-2+b1_${ARCHLOCAL}.deb" -o "/tmp/expect.deb"
sudo dpkg --extract "/tmp/expect.deb" /

# Auto start the probes
sudo npm i -g pm2
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
FAKE_PROBE_IP=$FAKE_PROBE_IP NODE_ENV=development PROBES_COUNT=$PROBES_COUNT API_HOST=ws://$API_HOST pm2 start dist/index.js
pm2 save
```
