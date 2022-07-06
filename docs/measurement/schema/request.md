# Measurement Request Schema

supported `type` values:
- [`ping`](#ping)
- [`traceroute`](#traceroute)
- [`dns`](#dns)
- [`mtr`](#mtr)

## shared values

### target

A public endpoint on which tests should be executed. In most cases, it would be a hostname or IPv4 address. Its validation rules might differ depending on the query type.

**key**: `measurement.target`

**required**: `true`

**rules**:
- typeof `string`
- `FQDN` or `IP Address`
- public address

```json
    "target": "globalping.io"
```

### limit

Specifies the global limit of probes.

Global limit controls the maximum number of tests the server will perform and doesn't guarantee availability; if there aren't enough probes available in specified locations, the result count might be lower.

**key**: `limit`

**required**: `false`

**rules**:
- typeof `number`
- min `1`
- max `500`

```json
    "limit": 5
```

### filter

Defines which filter mechanism should be used.

`combined` tells the API to match probes based on all supplied values, while `default` will select the first probe in order, based on one of the matches. Runs in `default` mode, when not specified.

**key**: `filter`

**required**: `false`

**rules**:
- `default` or `combined`
- `default` when not specified
- location limits can't be defined, when running in `combined` mode
- typeof `string`

```json
    "filter": "combined"
```

### locations

Specifies a list of desired locations from which tests should be run. The server distributes probes based on its preconfigured geo-weight algorithm if none is provided.

Each location filter is non-complementary and defines an individual set of probes. An optional `limit` key/value allows for more precise geo-queries.

If no match is found - the server skips that geo.

**key**: `locations`

**required**: `false`

**rules**:
- typeof `Location[]`
- each `Location` object must match one of the pre-defined types

**Allowed values**:

Please, see [LOCATION SCHEMA](./location.md) document for more details.


```json
    "locations": [
        {
            "type": "continent",
            "value": "eu",
            "limit": 10
        },
        {
            "type": "network",
            "value": "virgin media limited",
            "limit": 1
        },
        {
            "type": "magic",
            "value": "aws", // alias
            "limit": 1
        },
        {
            "type": "magic",
            "value": "pol", // (poland) partial match
            "limit": 1
        }
    ]
```

<h2 id="ping">PING</h2>

**type**: `ping`

Implementation of the native `ping` command.

The `ping` command sends an ICMP ECHO_REQUEST to obtain an ICMP ECHO_RESPONSE from a host or gateway.

example:

```json
{
    "measurement": {
        "type": "ping",
        "target": "google.com"
    },
    "locations": [],
    "limit": 5
}
```

### packets

Specifies the desired amount of `ECHO_REQUEST` packets to be sent.

```
Stop after sending count ECHO_REQUEST packets. With deadline option, ping waits for count ECHO_REPLY packets, until the timeout expires.
```

**key**: `measurement.packets`

**default**: `3`

**required**: `false`

**rules**:
- typeof `number`
- min `1`
- max `16`

```json
    "packets": 5
```

<h2 id="traceroute">TRACEROUTE</h2>

**type**: `traceroute`

Implementation of the native `traceroute` command.

traceroute tracks the route packets taken from an IP network on their way to a given host. It utilizes the IP protocol's time to live (TTL) field and attempts to elicit an ICMP TIME_EXCEEDED response from each gateway along the path to the host.

example:
```json
{
    "measurement": {
        "type": "traceroute",
        "target": "google.com",
        "protocol": "TCP",
        "port": 80
    },
    "locations": [],
    "limit": 1
}
```

### protocol

Specifies the protocol used for tracerouting.

**key**: `measurement.protocol`

**default**: `ICMP`

**required**: `false`

**available values**:
- `ICMP` (default)
- `TCP`
- `UDP`

**rules**:
- typeof `string`
- must match one of the pre-defined values

### port

Specifies the value of the `-p` flag. Only applicable for `TCP` protocol.

```
For TCP and others specifies just the (constant) destination port to connect.
```

**key**: `measurement.port`

**default**: `80`

**required**: `false`

**rules**:
- typeof `number`

```json
    "port": 5
```

<h2 id="dns">DNS</h2>

**type**: `dns`

Implementation of the native `dig` command.

Performs DNS lookups and displays the answers that are returned from the name server(s) that were queried.

**warning**:
DNS specific values have to be contained within `measurements.query` object.

example:
```json
{
    "measurement": {
        "type": "dns",
        "target": "google.com",
        "query": {
            "protocol": "UDP",
            "type": "A",
            "port": 53,
            "resolver": "1.1.1.1"
        }
    },
    "locations": [],
    "limit": 1
}
```

### target

The final destination of the request.

**key**: `measurement.target`

**required**: `true`

**rules**:
- typeof `string`
- `FQDN`

```json
    "target": "globalping.io"
```


### type

Specifies the DNS type for which to look for.

**key**: `measurement.query.type`

**default**: `A`

**required**: `false`

**available values**:
- `A`
- `AAAA`
- `ANY`
- `CNAME`
- `DNSKEY`
- `DS`
- `MX`
- `NS`
- `NSEC`
- `PTR`
- `RRSIG`
- `SOA`
- `TXT`
- `SRV`

**rules**:
- typeof `string`
- must match one of the pre-defined values

### protocol

Specifies the protocol used for DNS lookup.

**key**: `measurement.query.protocol`

**default**: `UDP`

**required**: `false`

**available values**:
- `TCP`
- `UDP`

**rules**:
- typeof `string`
- must match one of the pre-defined values

### port

Specifies the value of the `-p` flag.

```
Send the query to a non-standard port on the server, instead of the default port 53.
```

**key**: `measurement.query.port`

**default**: `53`

**required**: `false`

**rules**:
- typeof `number`

```json
    "port": 53
```

### resolver

Specifies the resolver server used for DNS lookup.

```
resolver is the name or IP address of the name server to query. This can be an IPv4 address in dotted-decimal notation or an IPv6 address in colon-delimited notation. When the supplied server argument is a hostname, dig resolves that name before querying that name server.
```

**key**: `measurement.query.resolver`

**required**: `false`

**rules**:
- typeof `string`
- `FQDN` or `IP Address`

```json
    "resolver": "1.1.1.1"
```
### trace

Toggle tracing of the delegation path from the root name servers for the name being looked up. It will follow referrals from the root servers, showing the answer from each server that was used to resolve the lookup.

**key**: `measurement.query.trace`

**required**: `false`

**rules**:
- typeof `boolean`

```json
    "trace": true
```

<h2 id="mtr">MTR</h2>

**type**: `mtr`

Implementation of the native `mtr` command.

mtr combines the functionality of the traceroute and ping programs in a single network diagnostic tool.

example:
```json
{
    "measurement": {
        "type": "mtr",
        "target": "google.com",
        "protocol": "ICMP",
        "port": 53,
        "packets": 10
    },
    "locations": [],
    "limit": 1
}
```

### protocol

Specifies the query protocol.

**key**: `measurement.protocol`

**default**: `ICMP`

**required**: `false`

**available values**:
- `ICMP` (default)
- `TCP`
- `UDP`

**rules**:
- typeof `string`
- must match one of the pre-defined values

### port

Specifies the value of the `-P` flag.

```
The target port number for TCP/SCTP/UDP traces.
```

**key**: `measurement.port`

**default**: `80`

**required**: `false`

**rules**:
- typeof `number`

```json
    "port": 53
```

### packets

Specifies the desired amount of `ECHO_REQUEST` packets to be sent.

```
Use this option to set the number of pings sent to determine both the machines on the network and the reliability of those machines.  Each cycle lasts one second.
```

**key**: `measurement.packets`

**default**: `3`

**required**: `false`

**rules**:
- typeof `number`
- min `1`
- max `16`

```json
    "packets": 5
```


