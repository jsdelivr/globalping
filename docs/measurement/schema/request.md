# Measurement Request Schema

## shared values

### target

The final destination of the request. Depending on query type - its validation rules might differ.

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

Specifies the `global limit` for probe count.

**key**: `limit`

**required**: `false`

**rules**:
- typeof `number`
- min `1`
- max `500`

```json
    "limit": 5
```

## PING

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

## TRACEROUTE

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

## DNS

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
    resolver": "1.1.1.1"
```
