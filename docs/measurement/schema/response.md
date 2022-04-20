# Measurement Response Schema

## Success

### schema

#### Id

**key**: `id`

**type**: `string`

Measurement Id number, obtained from [`POST /v1/measurements/`](../post-create.md) request.

#### type

**key**: `type`

**type**: `string`

The type of measurement. For more details about measurement type, please see [`MEASUREMENT REQUEST SCHEMA`](./request.md)

**available values**:
- `ping`
- `dns`
- `traceroute`

#### status

**key**: `status`

**type**: `string`

Measurement's current status. Communication between server and probes is asynchronious, thus the response should not be considered final, until this field returns `finished`.

**available values**:
- `finished`
- `in-progress`

#### createdAt / updatedAt

**key**: `createdAt` `updatedAt`

**type**: `number`

#### results[]

**key**: `results`

**type**: `Object[]`

An array of all probe responses. Jump to [`RESULT SCHEMA`](#result) for more details.

### example

```json
{
    "id": "tEaUg3vYnOu2exVC",
    "type": "ping",
    "status": "finished",
    "createdAt": 1650384403719,
    "updatedAt": 1650384404482,
    "results": [
        {
            "probe": {
                "continent": "AF",
                "region": "southern africa",
                "country": "ZA",
                "state": null,
                "city": "cape town",
                "asn": 16509,
                "longitude": 18.4232,
                "latitude": -33.9258,
                "network": "amazon.com inc."
            },
            "result": {
                "resolvedAddress": "172.217.170.14",
                "times": [
                    {
                        "ttl": 108,
                        "time": 16.5
                    },
                    {
                        "ttl": 108,
                        "time": 16.5
                    },
                    {
                        "ttl": 108,
                        "time": 16.5
                    }
                ],
                "min": 16.474,
                "avg": 16.504,
                "max": 16.543,
                "loss": 0,
                "rawOutput": "PING google.com (172.217.170.14) 56(84) bytes of data.\n64 bytes from 172.217.170.14: icmp_seq=1 ttl=108 time=16.5 ms\n64 bytes from 172.217.170.14: icmp_seq=2 ttl=108 time=16.5 ms\n64 bytes from 172.217.170.14: icmp_seq=3 ttl=108 time=16.5 ms\n\n--- google.com ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, time 402ms\nrtt min/avg/max/mdev = 16.474/16.504/16.543/0.028 ms"
            }
        }
    ]
}
```
## Result

### shared values

#### Result.probe

**key**: `Result.probe`

**type**: `Object`

Probe metadata, containing its precise geo location.

#### rawOutput

**key**: `Result.result.rawOutput`

**type**: `string`

The raw, unparsed stdout output from the native command.

### PING

#### resolvedAddress

**key**: Result.result.resolvedAddress`

**type**: `string`

IP Address contained within `ping` response header.

#### loss

**key**: `loss`

**type**: `number`

total count of lost packets.

#### times[]

**key**: `times[]`

**type**: `Object[]`

An array of all PING iterations before the deadline occured.

#### times[].ttl

**key**: `times[].ttl`

**type**: `number`

#### times[].time

**key**: `times[].time`

**type**: `number`

#### min / avg / max

**key**: `min` `avg` `max`

**type**: `number`

stats in millisecond contained within `ping` response footer.

