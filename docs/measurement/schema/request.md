# Measurement Request Schema

supported `type` values:
- [`ping`](#ping)
- [`traceroute`](#traceroute)
- [`dns`](#dns)
- [`mtr`](#mtr)
- [`http`](#http)

## shared values

### target

A public endpoint on which tests should be executed. In most cases, it would be a hostname or IPv4 address. Its validation rules might differ depending on the query type.

**key**: `target`

**required**: `true`

**rules**:
- typeof `string`
- `FQDN` or `IPv4/noCIDR Address`
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
            "continent": "eu",
            "limit": 10
        },
        {
            "network": "virgin media limited",
            "limit": 1
        },
        {
            "magic": "aws", // alias
            "limit": 1
        },
        {
            "magic": "pol", // (poland) partial match
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
    "type": "ping",
    "target": "google.com"
    "measurementOptions": {
        "packets": 6
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

**key**: `measurementOptions.packets`

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
    "type": "traceroute",
    "target": "google.com",
    "measurementOptions": {
        "protocol": "TCP",
        "port": 80
    },
    "locations": [],
    "limit": 1
}
```

### protocol

Specifies the protocol used for tracerouting.

**key**: `measurementOptions.protocol`

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

**key**: `measurementOptions.port`

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
DNS specific values have to be contained within `measurementOptions.query` object.

example:
```json
{
    "type": "dns",
    "target": "google.com",
    "measurementOptions": {
        "protocol": "UDP",
        "port": 53,
        "resolver": "1.1.1.1",
        "query": {
            "type": "A"
        }
    },
    "locations": [],
    "limit": 1
}
```

### target

The final destination of the request.

**key**: `target`

**required**: `true`

**rules**:
- typeof `string`
- `FQDN`

```json
    "target": "globalping.io"
```


### type

Specifies the DNS type for which to look for.

**key**: `measurementOptions.query.type`

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

**key**: `measurementOptions.protocol`

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

**key**: `measurementOptions.port`

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
resolver is the name or IP address of the name server to query. This can be an IPv4 address in dotted-decimal [...]. When the supplied server argument is a hostname, dig resolves that name before querying that name server.
```

**key**: `measurementOptions.resolver`

**required**: `false`

**rules**:
- typeof `string`
- `FQDN` or `IPv4/noCIDR Address`

```json
    "resolver": "1.1.1.1"
```
### trace

Toggle tracing of the delegation path from the root name servers for the name being looked up. It will follow referrals from the root servers, showing the answer from each server that was used to resolve the lookup.

**key**: `measurementOptions.trace`

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
    "type": "mtr",
    "target": "google.com",
    "measurementOptions": {
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

**key**: `measurementOptions.protocol`

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

**key**: `measurementOptions.port`

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

**key**: `measurementOptions.packets`

**default**: `3`

**required**: `false`

**rules**:
- typeof `number`
- min `1`
- max `16`

```json
    "packets": 5
```

<h2 id="http">HTTP</h2>

**type**: `http`

example:

```json
{
    "type": "http",
    "target": "jsdelivr.com",
    "port": 443,
    "protocol": "HTTPS",
    "request": {
        "path": "/",
        "query": "?a=abc",
        "method": "GET",
        "host": "jsdelivr.com",
        "headers": {
            "Referer": "https://example.com/"
        }
    }
}
```

### path

A URL pathname.

**key**: `measurementOptions.request.path`

**default**: `/`

**required**: `false`

**rules**:
- typeof `string`

### query

A query-string.

**key**: `measurementOptions.request.query`

**default**: `''` (empty string)

**required**: `false`

**rules**:
- typeof `string`

## host

Specifies the `Host` header, which is going to be added to the request.

```
  Host: example.com
```

**key**: `measurementOptions.request.host`

**default**: Host defined in `target`

**required**: `false`

**rules**:
- typeof `string`

### method

Specifies the HTTP method.

**key**: `measurementOptions.request.method`

**default**: `HEAD`

**required**: `false`

**available values**:
- `HEAD` (default)
- `GET`

**rules**:
- typeof `string`
- must match one of the pre-defined values

### headers

**key**: `measurementOptions.request.headers`

**default**: `{}`

**required**: `false`

**rules**:
- typeof `Object<string, string>`
- key `User-Agent` is overridden
- key `Host` is overridden

example:

```json
{
    ...
    "headers": {
        "Referer": "https://example.com/"
    }
}
```

### port

**key**: `measurementOptions.port`

**default**: `80` or `443` (depending on protocol)

**required**: `false`

**rules**:
- typeof `number`

### protocol

Specifies the query protocol.

**key**: `measurementOptions.protocol`

**default**: `HTTP`

**required**: `false`

**available values**:
- `HTTP` (default)
- `HTTPS`
- `HTTP2`

**rules**:
- typeof `string`
- must match one of the pre-defined values

### resolver

Specifies the resolver server used for DNS lookup.

**key**: `measurementOptions.resolver`

**required**: `false`

**rules**:
- typeof `string`
- `FQDN` or `IP Address`
