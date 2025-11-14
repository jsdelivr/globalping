# Globalping Infrastructure

This file describes where and how the production Globalping infrastructure works.
The purpose is to document everything for ourselves as well as allow everyone else to explore our services and contribute their own ideas for potential optimizations.

### API - api.globalping.io

The main production API that all probes and users connect to.

- Hosted on Hetzner in Falkenstein
- 2 VMs with 8 threads and 16GB RAM per VM
- 1 Load-balancer with health checks and TLS termination and automated LetsEncrypt certs
- The master branch is compiled into a Docker container automatically by Docker Hub
- Manually triggered deployments using Docker Swarm (Network host mode)

### API - Redis 7.x

Redis is used to cache GeoIP information from our IP databases, to store measurement results, and to sync connected probes between multiple API instances.

- Hosted with Hetzner in Falkenstein
- Dedicated server with 12 threads and 128GB RAM
- `maxmemory-policy allkeys-lru` Evict any key using approximated LRU.
- RedisJSON 2.x module enabled

### API - Measurement store (TimescaleDB)

TimescaleDB is used for long-term storage of measurement results.

- Hosted with Hetzner in Falkenstein
- Dedicated server with 24 threads, 128GB RAM, and 120 TB raid storage

### Elastic APM

- We use Elastic APM to monitor the API performance as well as to collect production logs
- Additionally, we use it to monitor the servers running the API and our other self-hosted servers

### DNS for *.globalping.io

- Hosted with Hetzner DNS
- Free plan

### Probes - Seeded datacenter network

We seeded the network with ~130 probes that we purchased from providers like Google Cloud, AWS, DigitalOcean, Vultr, OVH, Fly.io and Tencent.
Help us by [running our probe on your servers](https://github.com/jsdelivr/globalping-probe#readme) with spare capacity or by [becoming a GitHub Sponsor](https://github.com/sponsors/jsdelivr).
