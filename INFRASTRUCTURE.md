# Globalping Infrastructure

This file describes where and how the production Globalping infrastructure works. 
The purpose is to document everything for ourselves as well as allow everyone else to explore our services and contribute their own ideas for potential optimizations.

### API - api.globalping.io

The main production API that all probes and users connect to.

- Hosted on Heroku in Europe 
- Manually triggered deployments from GitHub `master` branch
- Integrated into GitHub
- Single Dyno "Standard 2X" - 1GB RAM and 4 CPU Cores
- $50/month


### API - Redis 6.x

Redis is used to cache GeoIP information from our 3 IP databases, to store all measurement results and to sync connected probes between multiple API instances. 

- Hosted with RedisLabs in Europe 
- 100MB RAM instance with multi-zone high-availability and data persistence
- Eviction policy `volatile-ttl`
- Max 256 connections
- RedisJSON 2.x module enabled
- $11/month


### API - APM Service AppSignal

We have basic integration with AppSignal that unfortunately doesn't meet our needs and we plan to replace it.

- Free


### Probes - Seeded datacenter network

We seeded the network with ~110 probes that we purchased from providers like Google Cloud, AWS, DigitalOcean, Vultr, OVH and Tencent.
Help us by [running our probe on your servers](https://github.com/jsdelivr/globalping-probe#readme) with spare capacity or by [becoming a GitHub Sponsor](https://github.com/sponsors/jsdelivr).

- ~$700/month

### DNS for *.globalping.io

- Hosted with Cloudflare without any CDN functionality
- Free plan
