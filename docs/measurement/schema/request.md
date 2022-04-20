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

