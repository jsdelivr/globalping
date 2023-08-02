<img width="1000" alt="Globalping Header" src="https://user-images.githubusercontent.com/1834071/163672078-67600178-79e1-448d-9e80-d1f8df79926b.png">


<p align="center">
    <b>Better understand your network routing, fix anycast issues, monitor your CDN and DNS performance,<br/>
        do uptime monitoring and build your own network tools for personal or public use. </b>
    <br/>
    <br />
</p>

## Invitation to contribute!

Everyone is welcome to contribute. Some suggestions:
- Ideas for new features
- PRs and fixes for existing problems
- Quality control and testing of all systems. Report any problems, bugs or bad UX you find
- Documentation. Our readme and documentation need some polish
- Tutorials and articles. Consider writing about our project on your blog or twitter

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## The Globalping Platform

Globalping is a platform that allows anyone to run networking commands such as ping, traceroute, dig and mtr on probes distributed all around the world. Our goal is to provide a free and simple API for everyone out there to build interesting networking tools and services. 

We don't expect most of our users to work with the API directly; instead, we constantly expand and improve our powerful yet simple tools that take full advantage of all the functionality that the Globalping API has to offer. If you're an advanced user, we recommend getting started with the [Globalping CLI](#globalping-cli), or if you prefer a visual representation of the data then our [web-tools](#web-based-tools) might be a better place to get started.

Learn more about Globalping on our website [www.jsdelivr.com/globalping](https://www.jsdelivr.com/globalping)

## Major sponsors

We thank our sponsors who contribute to the development of Globalping and help us expand the network of probes.

| <img src="https://gcore.com/favicon.ico" width="15" height="15"> [Gcore](https://gcore.com) | <img src="https://xtom.com/favicon.ico" width="15" height="15"> [xTom](https://xtom.com) | <img src="https://www.edisglobal.com/favicon.png" width="15" height="15"> [Edis Global](https://www.edisglobal.com) |
|---|---|---|

Consider [running our probe software](https://github.com/jsdelivr/globalping-probe) on your network of servers or [sponsor a batch of hardware probes](https://docs.google.com/document/d/1xIe-BaZ-6mmkjN1yMH5Kauw3FTXADrB79w4pnJ4SLa4/edit#heading=h.tmcgof2zm3yh) with your own stickers and swag included to ship to your users or distribute at conferences.
Stand out among the sea of water bottles and pens!

## Quick Start - Run your first test

You can begin using the platform in a few different ways:

### [Web Based Tools - Globalping website](https://www.jsdelivr.com/globalping)
[![globalping latency test from google cloud](https://github.com/jsdelivr/globalping/assets/1834071/760c9031-9292-4e2a-9901-68ef7f0745ca)](https://www.jsdelivr.com/globalping)

Our website is the best way to get started. You can start running tests immediatly and learn more about how different parts of the system work. 
For example our magic location field can accept not just locations but also cloud regions, ISP providers and even combine filters using the + symbol.

### [Globalping CLI](https://github.com/jsdelivr/globalping-cli)

Install our CLI tool to upgrade your network debugging capabilities. Get access to a global network of probes without leaving your command line!

```
#Ubuntu
curl -s https://packagecloud.io/install/repositories/jsdelivr/globalping/script.deb.sh | sudo bash
apt install globalping

#RHEL
curl -s https://packagecloud.io/install/repositories/jsdelivr/globalping/script.rpm.sh | sudo bash
dnf install globalping

#MacOS
brew tap jsdelivr/globalping
brew install globalping

#Windows
winget install globalping
OR
choco install globalping
```

And then run your tests in a familiar way:

```
$ globalping traceroute google.com from Western Europe --limit 2
> EU, DE, Frankfurt, ASN:210546
traceroute to google.com (142.250.185.78), 20 hops max, 60 byte packets
 1  10.0.0.1 (10.0.0.1)  0.747 ms  0.714 ms
 2  10.2.0.97 (10.2.0.97)  5.482 ms  5.511 ms
 3  10.10.0.1 (10.10.0.1)  613.232 ms  613.268 ms
 4  ae6-ffm21.core2.ffm3.de (45.138.175.101)  9.150 ms  9.188 ms
 5  ae1-core2.core3.ffm3.de (45.138.175.105)  6.027 ms  6.030 ms
 6  142.250.171.196 (142.250.171.196)  5.562 ms  5.749 ms
 7  209.85.244.249 (209.85.244.249)  48.691 ms  48.812 ms
 8  142.250.209.243 (142.250.209.243)  5.742 ms  5.743 ms
 9  fra16s48-in-f14.1e100.net (142.250.185.78)  5.716 ms  5.717 ms

> EU, NL, Zwolle, ASN:50673
...
```

[Learn more about Globalping CLI in the dedicated repo](https://github.com/jsdelivr/globalping-cli)

### Globalping REST API

If you're building something custom  or simply want to learn more about all the available options and data we provide check out the Globalping REST API.
It's as simple as: 

```
POST https://api.globalping.io/v1/measurements
{
    "limit": 10,
    "locations": [],
    "target": "jsdelivr.com",
    "type": "ping",
    "measurementOptions": {
        "packets": 5
    }
}
```

[Read the full API documentation](https://www.jsdelivr.com/docs/api.globalping.io) and [explore our dev demo](https://api.globalping.io/demo/)


### Slack App

Install our Slack App to interact with the Globalping platform without ever leaving Slack. Allow your NOC, OPS and Support teams to quickly debug networking issues and discuss the results.

<a href="https://bots.globalping.io/slack/install"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>

It supports a human friendly interface for issuing commands. To begin simply type `/globalping help`.

Examples:
```
/globalping {command} {target} from {location} --limit {number of probes}
/globalping ping 8.8.8.8 from Germany
/globalping traceroute jsdelivr.com from South America --limit 2
/globalping help
```

The location field can process all kinds of different types of location matching, including continents, regions, countries, cities, US states and ASNs. ASNs must be prefixed by "AS", e.g. `from AS80085`. 
You can also combine filters, e.g. `from hetzner+Finland` will ensure the results come from a probe that matches both parameters.
Providing no location will default to "world" which will match a probe from a random location in the world.

You can even mention it in threads using `@globalping ping google.com`

### GitHub Bot

Our GitHub bot can by triggered by simply mentioning it in any public GitHub issue. It supports a human friendly format of issuing commands and follows the existing Slack and CLI formatting logic allowing you to easily move between integrations. 

Examples:
```
@globalping ping 8.8.8.8 from Germany
@globalping traceroute jsdelivr.com from South America --limit 2
```

The location field can process all kinds of different types of location matching, including continents, regions, countries, cities, US states and ASNs. ASNs must be prefixed by "AS", e.g. `from AS80085`.

## Join the Network - Run a probe

Globalping relies on the community to help us expand our network of probes. So while we run our own probes in key locations we still need help from both corporate partners and individials. Consider joining our network and helping everyone by running a probe (or many). 
You can do it on a rented VPS or Dedicated server that has available capacity or even on a locally hosted Raspberry pi. The only requirement is having an internet accessible device able to run docker containers.

It's as simple as running this command:

```
docker run -d --log-driver local --network host --restart=always --name globalping-probe ghcr.io/jsdelivr/globalping-probe
```
And it works for both x86 and ARM architectures. 
[Podman related instructions.](https://github.com/jsdelivr/globalping-probe#podman-alternative)

Notes:
- The probe doesn't open any ports or accept any incoming connections. It can only establish a connection with our API.
- We include regularly updated lists and databases of domains and IPs that are associated with malware or potentially dangerous content and completely ban them on the API  level
- The tests scale to the amount of available CPU cores. Our code is very lightweight and shouldn't use too many of your resources, so in most cases we recommend running our probe as is. But if you're worried you can use `--cpuset-cpus="0-2"` to limit the number of available cores.
- We rate-limit all users on the API level to avoid the abuse of network
- No local network tests are allowed, only public endpoints.

Read more about the [Globalping Probe](https://github.com/jsdelivr/globalping-probe) in the dedicated repo.


## Limits | WIP

Our platform has multiple limits to avoid abusive behaviour and at the same time motivate people to contribute to the sustainability of our platform.

#### Global limits

These limits are applied per IP address regardless if an API key supplied or not.

- 100 POST requests per minute per IP. No GET limits are implemented to support "real-time" use-cases.
- A single measurement is limited to 200 probes per location and 500 total probes


#### Un-authenticated users

Anybody can connect to our API and start using it with no credentials required.
In this case we limit the amount of tests an IP address can run. A single test is defined as a succesful measurement we run and return to the user.
A limit of 10 tests means the user can run either 10 measurements with the probe limit set to 1 per measurement, or a single measurement with the probe limit set to 10.

- 100 tests per hour


#### Registered jsDelivr users - Free

All registered jsDelivr users get an API key they can use to authenticate themselves and get higher limits

- 200 measurements per hour
  

#### GitHub Sponsors - Contribute to the development of the project

By becoming a sponsor of jsDelivr you automatically help us sustain both the jsDelivr CDN and the Globalping platform.
Your contributions will be used to help us continue the development of all projects under the [jsDelivr Organization](https://github.com/jsdelivr)

You can do this by registering on jsdelivr.com and becoming a GitHub sponsor. 
We will then automatically upgrade your account to get a higher limit as defined in each of the available plans.


#### Custom limits

Feel free to reach out if you need a custom limit for your API key.
We're more than happy to provide higher limits to researchers, non-profits and other open source projects.


## Development

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for more information.
