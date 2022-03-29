<p align="center">
    <a href="TODO" target="_blank"><img width="260" height="39" src="LOGO" alt="Globalping Logo"></a>
    <br />
    <br />
    <b>A global network of community probes that allows you to measure, debug and monitor your internet services in real-time</b>
    <br/>
       Better understand your network routing, fix anycast issues, monitor your CDN and DNS performance, do uptime monitoring, build your own network tools for personal or public use. 
    <br />
    <br />
</p>

## The Globalping Platform

Globalping is a platform that allows anyone to run networking commands such as ping, traceroute, dig and mtr on distributed probes all around the world. Our goal is to provide a free and simple to use API for everyone out there to build interesting networking tools and services. 

But we don't expect most of our users to work with the API directly, instead we are constally building powerful yet simple tools that take advantage of all the functionality that the Globalping API has to offer. If you're an advanced user then we recommend getting started with the [Globalping CLI](#globalping-cli) or if you prefer a visual representation of the data then visit our tools on our website.

Learn more about Globalping on our website [www.jsdelivr.com/globalping](https://www.jsdelivr.com/globalping)


## Quick Start - Run your first test

You can begin using the platform in a few different ways:

### Web Based Tools

We keep building more and more web tools to cover all kinds of use-cases.

* TODO
* TODO

### Globalping CLI

Simply install our CLI tool to upgrade your debugging capabilities.

```
#add repo
yum install globalping-cli
```

And then run your tests in a familiar way:

```
globalping traceroute google.com --from "Western Europe" --limit "10"
#output
```

Learn more about Globalping CLI in the dedicated repo.


### Globalping REST API

If you're building something custom  or simply want to learn more about all the available options and data we provide check out the Globalping REST API.

#TODO

[Read the full API documentation](docs)


## Join the Network - Run a probe

Globalping relies on the community to help us expand our network of probes. So while we run our own probes in key locations we still need help from both corporate partners and individials. Consider joining our network and helping everyone by running a probe (or many). 
You can do it on a rented VPS or Dedicated server that has available capacity or even on a locally hosted Raspberry pi. The only requirement is having an internet accessible device able to run docker containers.

It's as simple as running this command:

```
docker run -d --restart=always ghcr.io/jsdelivr/globalping-probe --name globalping-probe
```

Notes:
- The probe doesn't open any ports or accept any incoming connections. It can only establish a connection with our API.
- We include regularly updated lists and databases of domains and IPs that are associated with malware or potentially dangerous content and completely ban them on the API  level
- The tests scale to the amount of available CPU cores. Our code is very lightweight and shouldn't use too many of your resources, so in most cases we recommend running our probe as is. But if you're worried you can use `--cpuset-cpus="0-2"` to limit the number of available cores.
- We rate-limit all users on the API level to avoid the abuse of network

Read more about the [Globalping Probe](https://github.com/jsdelivr/globalping-probe) in the dedicated repo.


## Limits

Our platform has multiple limits to avoid abusive behaviour and at the same time motivate people to contribute to the sustainability of our platform.

#### Global limits

These limits are applied per IP address regardless if an API key supplied or not.

- 100 requests per minute per IP. Covers both POST and GET.
- other?


#### Un-authenticated users

Anyone can connect to our API and start using without the need to provide any credentials.
In this case we limit the amount of tests an IP address can run. A single test is defined as a succesful measurement we run and return to the user.
So a limit of 10 tests means the user can either run 10 measurements with the probes limit set to 1 per measurement. Or run a single measurement with the probes limit set to 10.

- 100 tests per hour
- other?


#### Registered jsDelivr users - Free

All registered jsDelivr users get an API key they can use to authenticate themselves and get higher limits

- 200 measurements per hour
  

#### GitHub Sponsors - Contribute to the development of the project

By becoming a sponsor of jsDelivr you automatically help us sustain both the jsDelivr CDN and the Globalping platform.
Your contributions will be used to help us continue the development of all projects under the [jsDelivr Organization](https://github.com/jsdelivr)

You can do this by registering on jsdelivr.com and becoming a GitHub sponsor. 
We will then automatically upgrade your account to get a higher limit as defined in each of the available plans.


#### Custom limits

Contact us to discuss about getting a custom limit for your API key.
We're more than happy to provide higher limits to researchers, non-profits and other open source projects.



## Development

In order to run the Globalping API locally you will need Node.js 16 
and Redis with [RedisJSON](https://oss.redis.com/redisjson/) module.

API uses 3000 port by default. This can be overridden by `PORT` environment variable.

`FAKE_PROBE_IP=1` environment variable can be used to make debug easier. In that case every Probe 
that connects to the API will get an IP address from the list of predefined "real" addresses.

1. clone repository
2. `docker-compose up -d` - run redis
3. `npm install && npm run init:hooks && npm run build`
4. `npm run dev`
