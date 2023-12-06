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

Discover more about Globalping on our website [www.jsdelivr.com/globalping](https://www.jsdelivr.com/globalping)

## Our major donors
We thank our donors who contribute to the development of Globalping and help us expand our probe network!

| <img src="https://gcore.com/favicon.ico" width="15" height="15"> [Gcore](https://gcore.com) | <img src="https://xtom.com/favicon.ico" width="15" height="15"> [xTom](https://xtom.com) | <img src="https://www.edisglobal.com/favicon.png" width="15" height="15"> [Edis Global](https://www.edisglobal.com) |
|---|---|---|

### Support the Globalping community and platform 
We welcome any individual or company interested in supporting Globalping's growth and our mission to make the internet a faster place for everyone. 
Here are some ways you can help:

- [Run multiple probes](https://github.com/jsdelivr/globalping-probe): Globalping relies on a globally distributed network of probes for running network measurement requests. We're happy to list anyone who can host at least six probes as a donor on GitHub and our website.
- [Become a GitHub sponsor](https://www.jsdelivr.com/sponsors): By becoming a GitHub sponsor of [jsDelivr](https://github.com/jsdelivr), you are supporting both the jsDelivr CDN and the Globalping platform. Sponsors contributing $10 or more per month can request a hardware probe to install in their home or office.
- [Become a hardware probe provider](https://docs.google.com/document/d/1xIe-BaZ-6mmkjN1yMH5Kauw3FTXADrB79w4pnJ4SLa4/edit#heading=h.tmcgof2zm3yh): Sponsor a batch of co-branded hardware probes, including your own stickers and swag, to ship to your users or hand out at conferences.

## Get started writing tests
While we offer [different tools and integrations](#available-globalping-tools-and-integrations) for running tests with Globalping, we make sure that they provide a consistent experience. This also means that writing tests looks almost identical whether you're using the CLI tool or the Slack app, for example. 

Follow this structure when writing tests:

`globalping [command] [target] from [location] [flags]`

Let's look at each component:

##### Initiating a command
The way you initiate Globalping depends on the tool or integration you're using. For example, use `globalping` with the CLI tool, while using `@globalping` with the GitHub bot. Refer to the list of integrations below to learn how to use each in detail.

##### Available test commands
Globalping supports the following commands:
- ping
- traceroute
- mtr
- dns (similar to dig)
- http (similar to curl GET and HEAD)

##### Target
The target represents the destination for your test. This can be a domain name or an IP address for most test types.

##### Location
The location field can process different locations, including continents, regions, countries, cities, US states, and ASNs (prefixed by "AS," e.g., `from AS80085`). 
In general, our aim is to enable you to provide whatever location feels right.

Some examples:
- `from usa` or `from united states` - A random probe in the USA
- `from new york` -  A random probe in NYC
- `from aws` - A random probe hosted with Amazon

> [!NOTE]
> Providing no location defaults to `world`, selecting a probe from a random location.

Other location examples:
- europe, africa, asia
- east asia, north europe, eastern europe
- greece, canada, mexico, japan
- california, texas
- frankfurt, dallas, sydney
- as396982, as16509
- comcast, google, ovh, orange, t-mobile

##### Flags
All network test commands share some flags but also have unique ones. To learn more, run `--help` with the respective test type. For example, to find out more about `ping`, run:

`globalping ping --help`

###### The limit flag
The `--limit` flag is probably one of the most useful flags when starting with Globalping. It determines the number of tests to run, which is set to one (1) by default. 

For example:
- `from north america` selects one probe in either USA or Canada.
- `from north america --limit 2` selects one probe in USA **and** one in Canada.

## Available Globalping tools and integrations
In this section, we'll introduce you to the various tools and integrations with which you can use Globalping.

### [Web-based tools - Globalping website](https://www.jsdelivr.com/globalping)
[![globalping latency test from google cloud](https://github.com/jsdelivr/globalping/assets/1834071/760c9031-9292-4e2a-9901-68ef7f0745ca)](https://www.jsdelivr.com/globalping)

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

[Read the full API documentation](https://www.jsdelivr.com/docs/api.globalping.io) and [explore our dev demo](https://api.globalping.io/demo/)


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
> To make the app post test results in Slack Threads, mention it using `@globalping`. For example,  `@globalping ping google.com`

Learn more about the Slack app [on our blog](https://www.jsdelivr.com/blog/network-troubleshooting-in-slack-made-easy-with-globalping/).

### GitHub Bot
Automatically post network test results into any **public** GitHub issue with our GitHub bot. Mention it with `@globalping`, followed by the command you want to run. Otherwise, you can follow the same test command structure as with our other tools and integrations.

Example commands to try:
```
@globalping ping 8.8.8.8 from Germany
@globalping traceroute jsdelivr.com from South America --limit 2
```

Learn more about the GitHub bot [on our blog](https://dev.to/globalping/supercharge-your-gitops-workflows-with-the-globalping-github-bot-341a).

## Best practices and tips
Learn to use Globalping in the most optimal way!

### Test with "magic" 🧙
All integrations connect to the same API and use our "magic" field as location input.
This maintains a consistent and straightforward user experience, allowing you to reuse logic and parameters across all tools.

So, for example, when you run a test from "Germany" using the CLI or Slack app, our API's magic parser processes the location.

> [!Note]
> Developers who want stricter and more predictable control over the selected probes and user input can use the individual location parameters [when making an API call](https://www.jsdelivr.com/docs/api.globalping.io#post-/v1/measurements), which expect you to provide each city, country, and tag in a standardized way.

The magic field supports a wide range of parameters and location combinations, including countries, continents, cities, US states, regions (Western Europe), ASNs, ISP names, eyeball or data center tags, and cloud region names (us-east-2).

### Understand the "world" location 🌍

The `world` location uses a pseudo-random algorithm to select probes while [maintaining certain proportions](https://github.com/jsdelivr/globalping/blob/master/config/default.cjs#L47) per continent.

> [!Important]
> If you provide no location, the system defaults to using "world".
  
For example, when requesting tests `from world --limit 100`, the system aims to return probes proportionally from Africa (5 probes), Asia (15 probes), Europe (30 probes), Oceania (10 probes), North America (30 probes), and South America (10 probes).

### Level up your location-picking game 📍
You can use and combine different ways to run tests on multiple locations at once or fine-tune the location from where to pick a probe.  

#### Define multiple locations
To run tests at multiple locations, list them with a comma, for example:

- `from Berlin,South America,Idaho --limit 4`.

You can also define your own "world" location, for example:

- `from germany, greece, uk, usa, canada, japan, china, south africa --limit 20` 
returns probes from these countries in roughly equal proportions to meet the limit of 20.

>[!Important]
>The limit parameter is global and applies to the location as a whole, not allowing the API to return more than the limit. If you want to set custom limits per location, use our API directly instead of the "magic" field.

#### Define location filters
You can combine multiple locations using the plus symbol `+`, and use them as filters to define your desired probe locations more accurately. 

Examples:
- `from comcast+california` returns a probe on the Comcast network in California.
- `from google+europe` returns a Google Cloud probe in Europe. 
- `from google+germany` returns a Google Cloud probe in Germany (useful if you forget the cloud region name!).

Naturally, you can combine as many parameters as you like:
- `from cogent+europe+datacenter` returns a probe hosted at Cogent in Europe, tagged as a data center probe. Or you could use the `eyeball` tag to target probes that aren't part of a data center.

#### Leverage system tags (eyeball networks and more)
We have our system tag probes to help differentiate between probes and the network they belong to. 

The following tags are currently available to you:
- **Google Cloud and AWS cloud region names**. These tags follow the respective provider's naming scheme and are prefixed with their name, for example, `aws-eu-west-1` and `gcp-us-south1`.
- **Eyeball and data center network tags**. System tags include `eyeball` for probes hosted with ISPs that provide internet access to regular people and small businesses. As the name suggests, `datacenter` tags are intended for probes hosted in a data center.
#### Combine everything
When determining the location from which to run a test, you can take advantage of all the location-specific features described above and combine them.

Example:
- `from amazon+france,ovh+france --limit 2` returns a probe hosted on AWS in France and a probe hosted on OVH in France.

### Things to keep in mind

#### Probes share no UUIDs
Our probes don't expose unique IDs that you can use to target them explicitly. Instead, we recommend fine-tuning probe selection by using and combining filters as described in the best practice section above.

This ensures that popular locations, like `from Amsterdam` or `from AWS`, are automatically load-balanced across multiple probes within the same location, preventing the overload of specific probes.

#### Test result variability
When requesting a specific number of probes, there is no guarantee that the API will respond with the exact amount.

#### Probe availability rules
Globalping exposes and lets you interact with probes that are currently **online**. 

Here's when a probe is considered online and available through our API:
- **It's up-to-date.** A probe running an older version will be forced to auto-update before it becomes available.
- **It passes quality control tests.** Every probe must pass a test, ensuring it's connected to a reasonably stable network without packet loss. This test is done regularly; if a probe fails, it gets taken offline.

This whole process is completely automated and managed by our platform.

## Join the network – Run a virtual probe
Globalping relies on the community to expand its probe network. While we maintain our own probes in key locations, we welcome any support from both corporate partners and individuals. 
[Join our network](https://github.com/jsdelivr/globalping-probe) and help make the internet faster for everyone by running a virtual probe (or several).

### Quick start guide
You can run a Globalping probe on any machine that can run a Docker container, supporting x86 and ARM architectures. For example, you can use a rented VPS, a dedicated server with spare capacity, or even your locally hosted Raspberry PI.

Use this command to create and run the Globalping probe container:

```
docker run -d --log-driver local --network host --restart=always --name globalping-probe ghcr.io/jsdelivr/globalping-probe
```
Find instructions for Podman [here](https://github.com/jsdelivr/globalping-probe#podman-alternative) 

### Notes on probe security and customization
- Probes don't open ports or accept incoming connections. They can only connect with our API.
- We work with regularly updated lists and databases of domains and IPs associated with malware or potentially dangerous content and completely ban them at the API  level.
- The API is rate-limited to prevent users from abusing the network.
- Only public endpoints are permitted for testing; no local network tests are allowed.
- Tests scale based on available CPU cores. Our code is very lightweight and shouldn't use too many of your resources. Therefore, in most cases, we recommend running our probe as is. However, if you want more control, you can use `--cpuset-cpus="0-2"` with your Docker command to set the number of cores.

Learn more in the [Globalping Probe respository](https://github.com/jsdelivr/globalping-probe).

## Limits | WIP
To maintain a sustainable environment, our platform implements several usage limits to prevent abusive behavior while encouraging contributions. Here's an overview:

#### Global limits
These limits apply per IP address for all Globalping users:

- 100 POST requests per minute per IP. No GET limits are implemented to support "real-time" use cases.
- A single measurement is limited to 200 probes per location and 500 total probes.

#### Unauthenticated users
Anyone can connect to and use our API without requiring any credentials.
For users without authentication, we limit the number of tests an IP address can run:

- 100 tests per hour 

>[!note]
> A test is defined as a successful measurement the platform runs and returns to the user. For example, a limit of 10 tests means that users can either run 10 measurements with the probe limit set to 1 per measurement or a single measurement with the probe limit set to 10.

#### Registered jsDelivr users – Free
All registered jsDelivr users get an API key for authentication, granting them higher limits:

- 200 tests per hour

#### GitHub Sponsors
As a GitHub Sponsor of jsDelivr, your contributions help us continue the development of all projects under the [jsDelivr Organization](https://github.com/jsdelivr).

As a thanks, we upgrade your account to receive higher limits.

#### Custom limits
Feel free to reach out if you need a custom limit for your API key.

We're happy to provide higher limits for researchers, non-profits, and other open-source projects.

## Support and feedback
If you are stuck or want to give us your feedback, please [open a new issue](https://github.com/jsdelivr/globalping/issues).

## Development
Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for more information.