# Running a development environment on a remote host

This guide outlines the steps to set up and run a development environment on a remote host. It is aimed to be used mostly for performance benchmarking. The environment consists of three parts: Redis, API, and Probes. For every part there is a bash script which prepares and runs everything. Every script is executed on a separate Ubuntu server.

## Redis

```bash
# Make sure port 6379 is open
# Update that variables with your values
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

# Autostart docker compose
echo "[Unit]
Description=Redis
After=docker.service

[Service]
Type=oneshot
User=$(whoami)
ExecStart=docker compose -f /home/ubuntu/globalping/docker-compose.yml up -d

[Install]
WantedBy=default.target" | sudo tee /etc/systemd/system/redis.service > /dev/null

# Run the service
sudo systemctl enable redis.service
sudo systemctl start redis.service
sudo systemctl status redis.service
```
