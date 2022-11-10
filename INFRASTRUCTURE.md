# Globalping Infrastructure

This file describes where and how the production Globalping infrastructure works. 
The purpose is to document everything for ourselves as well as allow everyone else to explore our services and contribute their own ideas for potential optimizations.

### API - api.globalping.io

The main production API that all probes and users connect to.

- Hosted on Hetzner in Falkenstein
- 2xVMs with 4 threads and 8GB RAM per VM
- 1 Load-balancer with health-checks and TLS termination and automated LetsEncrypt certs
- Master branch is compiled into a Docker container automatically by Docker Hub.
- Manually triggered deployments using Docker Swarm (Network host mode)
- $33/month


### API - Redis 7.x

Redis is used to cache GeoIP information from our 3 IP databases, to store all measurement results and to sync connected probes between multiple API instances. 

- Hosted with Hetzner in Falkenstein
- Dedicated server with 12 threads and 64GB RAM 
- `maxmemory-policy allkeys-lru` Evict any key using approximated LRU.
- RedisJSON 2.x module enabled
- $46/month


### API - APM Service New Relic

- We use New Relic in our API to monitor it's performance and stablity as well as to collect production logs
- Addionally we use it to monitor the servers running the API and our self-hosted Redis database
- EU region account
- Free plan

### DNS for *.globalping.io

- Hosted with Hetzner DNS
- Free plan

### Probes - Seeded datacenter network

We seeded the network with ~130 probes that we purchased from providers like Google Cloud, AWS, DigitalOcean, Vultr, OVH, Fly.io and Tencent.
Help us by [running our probe on your servers](https://github.com/jsdelivr/globalping-probe#readme) with spare capacity or by [becoming a GitHub Sponsor](https://github.com/sponsors/jsdelivr).

- ~$790/month
