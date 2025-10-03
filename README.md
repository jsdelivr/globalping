<img width="1000" alt="Globalping Header" src="https://user-images.githubusercontent.com/1834071/163672078-67600178-79e1-448d-9e80-d1f8df79926b.png">


<p align="center">
    <b>Gain insights into your network routing from any location in the world!<br />
    Troubleshoot anycast issues, monitor CDN and DNS performance, perform uptime monitoring,<br />and build your own network tools for personal or public use.</b>
    <br/>
    <br />
</p>

## Invitation to contribute!
Everyone is welcome to contribute – here are some ways you can get involved:
- Suggest ideas for new features.
- Submit pull requests and fixes for existing issues.
- Help us with quality control and testing across systems. Report any problems, bugs, or bad user experience you find.
- Contribute to the documentation.
- Write tutorials and articles and help spread the word about Globalping on your blog or other platforms.

Refer to [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## The Globalping Platform
Globalping allows anyone to run networking commands such as ping, traceroute, dig, and mtr on probes distributed around the globe. Our goal is to provide a free, user-friendly API for everyone to build interesting networking tools and services.

Many users will likely prefer alternative ways to use the platform rather than working directly with the API. Therefore, to make Globalping accessible to all kinds of users, we're constantly expanding and improving our tools, all of which leverage the full potential of the Globalping API:

- [CLI tool](#globalping-cli) for people who feel at home in their terminal
- [Web tools](#web-based-tools---globalping-website) for on-the-go testing and visual presentations
- [Slack app](#slack-app) for bringing network testing capabilities into your Slack workspace
- [GitHub bot](#github-bot) for adding network test results to public GitHub issues
- [Find more integrations on our website](https://globalping.io/integrations)

Learn more about Globalping on [globalping.io](https://globalping.io)

Register on the [Globalping Dashboard](https://dash.globalping.io/)  to increase your limits and adopt probes to earn free credits!

## Our major sponsors
We thank our sponsors who contribute to the development of Globalping and help us expand our probe network!

| <img src="https://gcore.com/favicon.ico" width="15" height="15"> [Gcore](https://gcore.com) | <img src="https://xtom.com/favicon.ico" width="15" height="15"> [xTom](https://xtom.com) | <img src="https://www.edisglobal.com/favicon.png" width="15" height="15"> [Edis Global](https://www.edisglobal.com) |
|---|---|---|

### Support the Globalping community and platform
We welcome any individual or company interested in supporting Globalping's growth and our mission to make the internet a faster place for everyone.
Here are some ways you can help:

- [Run multiple probes](https://github.com/jsdelivr/globalping-probe): Globalping relies on a globally distributed network of probes for running network measurement requests. We're happy to list anyone who can host at least six probes as a donor on GitHub and our website.
- [Become a GitHub sponsor](https://github.com/sponsors/jsdelivr): By becoming a GitHub sponsor of [jsDelivr](https://github.com/jsdelivr), you are supporting both the jsDelivr CDN and the Globalping platform. Sponsors contributing $10 or more per month can request a hardware probe to install in their home or office.
- [Become a hardware probe provider](https://docs.google.com/document/d/1xIe-BaZ-6mmkjN1yMH5Kauw3FTXADrB79w4pnJ4SLa4/edit#heading=h.tmcgof2zm3yh): Sponsor a batch of co-branded hardware probes, including your own stickers and swag, to ship to your users or hand out at conferences.

##  Quick start – Run your first tests
Whether you're new to network testing or are a seasoned pro, getting started with Globalping is straightforward. Let's check out how you can run your first tests using our various tools and integrations:

### [Web-based tools - Globalping website](https://globalping.io)
[![globalping latency test from google cloud](https://github.com/jsdelivr/globalping/assets/1834071/760c9031-9292-4e2a-9901-68ef7f0745ca)](https://globalping.io)

Our website offers the fastest way to get started. Run tests instantly from anywhere and experiment with the different options for different test types. For each test, you can view the probes used on a map and get a detailed view of the individual test results below.

### [Globalping CLI](https://github.com/jsdelivr/globalping-cli)
Upgrade your network debugging capabilities by installing the Globalping CLI tool. Get access to our global network of probes without leaving your terminal!

Install the CLI on Linux, macOS, or Windows using the command for your package manager:

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

And then run your tests:

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

Learn more about the Globalping CLI [in its repository](https://github.com/jsdelivr/globalping-cli)

### Globalping REST API
If you want to build something custom or simply learn more about all the available options and data we provide, check out the Globalping REST API.

Creating a new measurement test is as simple as:

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

[Read the full API documentation](https://globalping.io/docs/api.globalping.io) and [explore our dev demo](https://api.globalping.io/demo/)


### Slack App
Improve collaboration in your workspace by installing our Slack app, enabling everyone to interact with Globalping without leaving Slack. The app is especially handy for NOC, OPS, and Support teams collaborating on debugging networking issues and discussing results.

<a href="https://bots.globalping.io/slack/install"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>

To initiate a command with the Globalping Slack app, use the slash command `/globalping`. Apart from that, you can use the same test command structure as with our other tools and integrations. For example, to get started, type `/globalping help`.

Example commands to try:
```

/globalping ping 8.8.8.8 from Germany

/globalping traceroute jsdelivr.com from South America --limit 2

```

>[!Important]
> To make the app post test results in Slack Threads, mention it using `@globalping`. For example,  `@globalping ping google.com`

Learn more about the Slack app [on our blog](https://blog.globalping.io/network-troubleshooting-in-slack-made-easy-with-globalping/).

### GitHub Bot
Automatically post network test results into any **public** GitHub issue with our GitHub bot. Mention it with `@globalping`, followed by the command you want to run. Otherwise, you can follow the same test command structure as with our other tools and integrations.

Example commands to try:
```
@globalping ping 8.8.8.8 from Germany
@globalping traceroute jsdelivr.com from South America --limit 2
```

Learn more about the GitHub bot [on our blog](https://dev.to/globalping/supercharge-your-gitops-workflows-with-the-globalping-github-bot-341a).

## Globalping command structure
We make sure that all integrations and tools provide a consistent experience, so writing tests looks almost identical whether you're using the CLI tool, the Slack app, or another official integration.

Follow this structure when writing measurement commands:

`globalping [command] [target] from [location] [flags]`

Examples:
- `globalping ping google.com from aws`
- `globalping ping google.com from Berlin, South America --limit 2`

Let's look at the components:
##### Available test types
Globalping supports the following:
- ping
- traceroute
- mtr
- dns (similar to dig)
- http (similar to curl GET and HEAD)
##### Target
The target represents the destination for your test. This can be a domain name or an IP address for most test types.
##### Location
The location field can process different locations, including continents, regions, countries, cities, US states, and ASNs (prefixed by "AS," e.g., `from AS80085`). You can also specify measurement IDs from previous tests to reuse the same probes.
>[!TIP]
>Check out our [best pracises and tips](#basic-location-targeting-) to learn how to define locations effectively.

## Best practices and tips
Learn to use Globalping in the most optimal way!

### Test with "magic" 🧙
All integrations connect to the same API and use our "magic" field as location input.
This is the best way to interact with Globalping, as it maintains a consistent and straightforward user experience, allowing you to reuse logic and parameters across all tools.

So, for example, when you run a test from "Germany" using the CLI, Slack app, or any other official integration, our API's magic parser processes the location.

> [!Note]
> Developers who want stricter and more predictable control over the selected probes and user input can use the individual location parameters [when making an API call](https://globalping.io/docs/api.globalping.io#post-/v1/measurements), which expect you to provide each city, country, and tag in a standardized way.

The magic field supports a wide range of parameters and location combinations, including countries, continents, cities, US states, regions (Western Europe), ASNs, ISP names, eyeball or data center tags, and cloud region names (us-east-2).

### Reselect probes ♻️
You can also provide the "magic" field with a measurement ID to have the API select the same probes used in a previous measurement.

For example:
- `from WZIAtMx4LLhzit02`

> [!IMPORTANT]
> This is a best-effort action, and if some of the probes are no longer online, they will be missing from the new results. Additionally, as measurements expire (lifetime depends on user type), you should not hard-code measurement IDs, as new tests will break after a measurement expires.

You can obtain the measurement ID through the "share" functionality. For example, use `--share` in the CLI, find the "Share URL" section at the bottom of the web results or receive it by calling the API directly.

Some practical use cases:
- Increase the reliability of network endpoint comparisons, such as CDN, DNS, and edge compute benchmarking, as well as provider comparisons.
- Support troubleshooting by preselecting the probes in problematic networks and running different tests, with different parameters if needed but with the same probes, until your issue is solved.
- Emulate a continuously running ping or mtr by reusing probes and stitching together the output of different measurements into a single output.

### Understand the "world" location 🌍

The `world` location is special and uses a pseudo-random algorithm to select probes while [maintaining certain proportions](https://github.com/jsdelivr/globalping/blob/master/config/default.cjs#L47) per continent.

> [!Important]
> If you provide no location, the system defaults to using "world".

For example, when requesting tests `from world --limit 100`, the system aims to return probes proportionally from Africa (5 probes), Asia (15 probes), Europe (30 probes), Oceania (10 probes), North America (30 probes), and South America (10 probes).

### Basic location targeting 📍
Our aim is to enable you to provide whatever location feels right – some examples:
- `from usa` or `from united states` - A random probe in the USA
- `from new york` -  A random probe in NYC
- `from aws` - A random probe hosted with Amazon
- `from WZIAtMx4LLhzit02` - Selects the same probes that were used for the specified measurement

We'd only get one probe in these examples because we didn't specify a limit. But, if you select a large region, for instance, you expect to get multiple results.
Use the `--limit` flag to define the number of tests to run, which is set to one (1) by default.

For example:
- `from north america` selects one probe in either USA or Canada.
- `from north america --limit 2` selects one probe in USA **and** one in Canada.

Other location examples:
- europe, africa, asia
- east asia, north europe, eastern europe
- greece, canada, mexico, japan
- california, texas
- frankfurt, dallas, sydney
- as396982, as16509
- comcast, google, ovh, orange, t-mobile
- eyeball, datacenter

> [!NOTE]
> Providing no location defaults to `world`, selecting a probe from a random location.
### Stack location filters 🍔
You can combine multiple locations using the plus symbol `+`, and use them as filters to define your desired probe locations more accurately.

Examples:
- `from comcast+california` returns a probe on the Comcast network in California.
- `from google+europe` returns a Google Cloud probe in Europe.
- `from google+germany` returns a Google Cloud probe in Germany (useful if you forget the cloud region name!).

You can combine as many parameters as you like:
- `from cogent+europe+datacenter` returns a probe hosted at Cogent in Europe, tagged as a data center probe. Or you could use the `eyeball` tag to target probes that aren't part of a data center.
### Define multiple locations 🌐
To run tests at multiple locations in a single request, list them with a comma, for example:

- `from Berlin,South America,Idaho --limit 4`.

Naturally, you can combine filters and multiple locations at the same time:

- `from amazon+france,ovh+france --limit 2` returns a probe hosted on AWS in France and a probe hosted on OVH in France.

You can also define your own "world" location, for example:

- `from germany, greece, uk, usa, canada, japan, china, south africa --limit 20`

returns probes from these countries in roughly equal proportions to meet the limit of 20.

>[!Important]
>The limit parameter is global and applies to the location as a whole, not allowing the API to return more than the limit. If you want to set custom limits per location, use our API directly instead of the "magic" field.

### Leverage system tags (eyeball networks and more) 🏷️
Many probes are going to be tagged by our system. At the moment, this includes:

- **Google Cloud and AWS cloud region names**. For example, `aws-eu-west-1` and `gcp-us-south1`. These tags follow the respective provider's naming scheme and are prefixed with their name.
- **Eyeball and data center network tags**. `eyeball` and `datacenter`. `eyeball` probes are hosted with ISPs that provide internet access to regular people and small businesses. As the name suggests, `datacenter` tags are intended for probes hosted in a data center.

### Things to keep in mind

#### Probes share no UUIDs
Our probes don't expose unique IDs that you can use to target them explicitly. Instead, we recommend fine-tuning the probe selection by using and combining filters or specifying IDs from previous measurements, as described in the best practice section above.

This ensures that popular locations, like `from Amsterdam` or `from AWS`, are automatically load-balanced across multiple probes within the same location, preventing the overload of specific probes.

#### Best-effort results
When requesting a specific number of probes, there is no guarantee that the API will respond with the exact amount.

#### Probe availability rules
Globalping exposes and lets you interact with probes that are currently **online**.

Here's when a probe is considered online and available through our API:
- **It's up-to-date.** A probe running an older version will be forced to auto-update before it becomes available.
- **It passes quality control tests.** Every probe must pass a test, ensuring it's connected to a reasonably stable network without packet loss. This test is done regularly; if a probe fails, it gets taken offline.
- **It's not behind a VPN**. We block probes that we detect are hosted behind VPNs or other proxying techniques, as they would report incorrect latency and routing data, making them unusable.

This whole process is completely automated and managed by our platform.

## Join the network – Run a probe
Globalping relies on the community to expand its probe network. While we maintain our own probes in key locations, we welcome any support from both corporate partners and individuals.
[Join our network](https://github.com/jsdelivr/globalping-probe) and help make the internet faster for everyone by running a probe (or several).

### Setup instructions
You can run a Globalping probe on any internet-accessible device that can run a Docker container. For example, you can use a rented VPS, a dedicated server with spare capacity, or even your locally hosted Raspberry PI.

Use this command to create and run the Globalping probe container:

```
docker run -d --log-driver local --network host --restart=always --name globalping-probe globalping/globalping-probe
```
And it works on x86 and ARM architectures. [Podman instructions](https://github.com/jsdelivr/globalping-probe#podman-alternative)

Notes on probe security and customization
- Probes don't open any ports or accept any incoming connections. They can only establish a connection with our API.
- We include regularly updated lists and databases of domains and IPs associated with malware or potentially dangerous content and completely ban them at the API  level.
- Tests scale to the amount of available CPU cores. Our code is very lightweight and shouldn't use too many of your resources. Therefore, in most cases, we recommend running our probe as is. However, if you're worried, you can use `--cpuset-cpus="0-2"` with your Docker command to limit the number of available cores.
- We rate-limited all users on the API level to prevent the abuse of the network.
- No local network tests are allowed, only public endpoints.

Learn more in the [Globalping Probe respository](https://github.com/jsdelivr/globalping-probe).

## Limits
Our platform has multiple limits to prevent abusive behaviour while motivating people to contribute to the sustainability of the project. Here's an overview:

#### Global limits
These limits apply per IP address to all users:

- 2 GET requests per second per measurement.

#### Unauthenticated users
Anyone can connect to and use our API without credentials.
For users without authentication, we limit the number of tests an IP address can run:

- 250 tests per hour

>[!note]
> A test is defined as a successful measurement the platform runs from one probe. For example, a limit of 10 tests means that users can either run 10 measurements with the probe limit set to 1 per measurement or a single measurement with the probe limit set to 10.

#### Registered users – Free
All registered users get an API key for authentication, granting them higher limits - register on our [Dashboard](https://dash.globalping.io/):

- 500 tests per hour

Additionally, users hosting probes receive 150 credits per day for each probe.

>[!note]
> Credits allow you to run measurements above the hourly limits and are automatically
> deducted from your account as needed. Each test above the limit costs one credit.
> Credits have no expiration and keep accumulating in your account when you don't use them.

#### GitHub Sponsors
As a GitHub Sponsor of jsDelivr, your contributions help us continue the development of all projects under the [jsDelivr Organization](https://github.com/jsdelivr).

As a thanks, you receive additional 2000 credits for every dollar donated.

#### Custom limits
Feel free to reach out if you need a custom limit for your API key.

We're happy to provide free credits for researchers, non-profits, and other open-source projects.

## Support and feedback
If you are stuck or want to give us your feedback, please [open a new issue](https://github.com/jsdelivr/globalping/issues).

## Development
Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for more information.
