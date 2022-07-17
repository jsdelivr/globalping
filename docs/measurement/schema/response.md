# Measurement Response Schema

Jump to:
- [`Full success schema`](#success)
- [`Result schema`](#result)
- [`Ping Result schema`](#ping)
- [`Traceroute  Result schema`](#traceroute)
- [`DNS Result schema`](#dns)

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

**type**: `string` (ISO)

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
    "createdAt": "2022-07-17T16:19:52.909Z",
    "updatedAt": "2022-07-17T16:19:52.909Z",
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

possible result types:
- [`ping`](#ping)
- [`traceroute`](#traceroute)
- [`dns`](#dns)

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

**key**: `Result.result.loss`

**type**: `number`

total count of lost packets.

#### times[]

**key**: `Result.result.times[]`

**type**: `Object[]`

An array of all PING iterations before the deadline occured.

#### times[].ttl

**key**: `Result.result.times[].ttl`

**type**: `number`

#### times[].time

**key**: `Result.result.times[].time`

**type**: `number`

#### min / avg / max

**key**: `Result.result.min` `Result.result.avg` `Result.result.max`

**type**: `number`

stats in millisecond contained within `ping` response footer.

### TRACEROUTE

#### destination

**key**: `Result.result.destination`

**type**: `string`

IP Address contained within `traceroute` response header.

#### hops[]

**key**: `Result.result.hops[]`

**type**: `Object[]`

An array of all traceroute iterations before the deadline occured.

#### hops[].host

**key**: `Result.result.hops[].host`

**type**: `string`

reported hostame.

#### hops[].resolvedAddress

**key**: `Result.result.times[].time`

**type**: `string`

reported ip address.

#### hops[].rtt[]

**key**: `Result.result.times[].rtt[]`

**type**: `number[]`

the delay between sending the packet and getting the response.

### DNS

***warning!***: In case the measurement was requested with `toggle` enabled, the `Reasult.result` will be of type `Object[]`. This is because each trace path is returned individually by the probe.

example:
```json
{
    "id": "tEaUg3vYnOu2exVC",
    "type": "ping",
    "status": "finished",
    "createdAt": "2022-07-17T16:19:52.909Z",
    "updatedAt": "2022-07-17T16:19:52.909Z",
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
          "result": [
            {
              "time": 4,
              "server": "127.0.0.53",
              "answer": [
                {
                  "domain": ".",
                  "type": "NS",
                  "ttl": "6593",
                  "class": "IN",
                  "value": "c.root-servers.net."
                },
                ...
                {
                  "domain": ".",
                  "type": "NS",
                  "ttl": "6593",
                  "class": "IN",
                  "value": "h.root-servers.net."
                }
              ]
            },
            {
              "time": 24,
              "server": "d.root-servers.net",
              "answer": [
                {
                  "domain": "net.",
                  "type": "NS",
                  "ttl": "172800",
                  "class": "IN",
                  "value": "a.gtld-servers.net."
                },
                ...
                {
                  "domain": "net.",
                  "type": "RRSIG",
                  "ttl": "86400",
                  "class": "IN",
                  "value": "nStNJg=="
                }
              ]
            },
            {
              "time": 32,
              "server": "c.gtld-servers.net",
              "answer": [
                {
                  "domain": "jsdelivr.net.",
                  "type": "NS",
                  "ttl": "172800",
                  "class": "IN",
                  "value": "dns1.p03.nsone.net."
                },
                ...
                {
                  "domain": "GBMGFDMMHIENHS2RNSDAQ541H88GB5IO.net.",
                  "type": "RRSIG",
                  "ttl": "86400",
                  "class": "IN",
                  "value": "NO9LoUolBGhvxHSQfhwCyAi0slPURsAkC4DBUS1WrpipCQ=="
                }
              ]
            },
            {
              "time": 28,
              "server": "gns3.cloudns.net",
              "answer": [
                {
                  "domain": "cdn.jsdelivr.net.",
                  "type": "CNAME",
                  "ttl": "900",
                  "class": "IN",
                  "value": "jsdelivr.map.fastly.net."
                }
              ]
            }
          ],
          "rawOutput": "; <<>> DiG 9.18.1-1ubuntu1-Ubuntu <<>> +trace +nocookie +tries +timeout cdn.jsdelivr.net\n;; global options: +cmd\n.\t\t\t6593\tIN\tNS\tj.root-servers.net.\n.\t\t\t6593\tIN\tNS\tc.root-servers.net.\n.\t\t\t6593\tIN\tNS\tg.root-servers.net.\n.\t\t\t6593\tIN\tNS\tb.root-servers.net.\n.\t\t\t6593\tIN\tNS\ti.root-servers.net.\n.\t\t\t6593\tIN\tNS\ta.root-servers.net.\n.\t\t\t6593\tIN\tNS\te.root-servers.net.\n.\t\t\t6593\tIN\tNS\tl.root-servers.net.\n.\t\t\t6593\tIN\tNS\tk.root-servers.net.\n.\t\t\t6593\tIN\tNS\tf.root-servers.net.\n.\t\t\t6593\tIN\tNS\tm.root-servers.net.\n.\t\t\t6593\tIN\tNS\td.root-servers.net.\n.\t\t\t6593\tIN\tNS\th.root-servers.net.\n;; Received 811 bytes from 127.0.0.53#53(127.0.0.53) in 4 ms\n\nnet.\t\t\t172800\tIN\tNS\ta.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tb.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tc.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\td.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\te.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tf.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tg.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\th.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\ti.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tj.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tk.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tl.gtld-servers.net.\nnet.\t\t\t172800\tIN\tNS\tm.gtld-servers.net.\nnet.\t\t\t86400\tIN\tDS\t35886 8 2 7862B27F5F516EBE19680444D4CE5E762981931842C465F00236401D 8BD973EE\nnet.\t\t\t86400\tIN\tRRSIG\tDS 8 1 86400 20220509170000 20220426160000 47671 . IbbmgURsOFU02lEF33VZIt90+xd+DSAy6n+LowQlVMbxAxB6BsF5nNi1 n0Xsfixgxk06JOsQOLeMnTSX6xGZ5baCHa8pWGlS2CZ3wpmWt9Fg5Y/r Vqpneq9sBXuvcyLZ4OOzxqY8Xvqnj5EBqx2wegOxqOzbw4I2MLPeFWS4 hRvHcodnVkAHaWbDWLi3olY+8nIdWMLRdMxA1VkzliQn0MOPNn6mhKeG HTh3uOo7FSm+adbefRhC6X8QDoSFQ6VKYhd3mVJ7HGJ2JsvpVsJlG5Ff WNBztAw7W5Tg9aIVxPwfl3tNvlkpyvDqgurJLXVqmB7F+t3f3+8QKDMb nStNJg==\n;; Received 1173 bytes from 199.7.91.13#53(d.root-servers.net) in 24 ms\n\njsdelivr.net.\t\t172800\tIN\tNS\tdns1.p03.nsone.net.\njsdelivr.net.\t\t172800\tIN\tNS\tdns2.p03.nsone.net.\njsdelivr.net.\t\t172800\tIN\tNS\tdns3.p03.nsone.net.\njsdelivr.net.\t\t172800\tIN\tNS\tdns4.p03.nsone.net.\njsdelivr.net.\t\t172800\tIN\tNS\tgns1.cloudns.net.\njsdelivr.net.\t\t172800\tIN\tNS\tgns2.cloudns.net.\njsdelivr.net.\t\t172800\tIN\tNS\tgns3.cloudns.net.\njsdelivr.net.\t\t172800\tIN\tNS\tgns4.cloudns.net.\nA1RT98BS5QGC9NFI51S9HCI47ULJG6JH.net. 86400 IN NSEC3 1 1 0 - A1RTLNPGULOGN7B9A62SHJE1U3TTP8DR NS SOA RRSIG DNSKEY NSEC3PARAM\nA1RT98BS5QGC9NFI51S9HCI47ULJG6JH.net. 86400 IN RRSIG NSEC3 8 2 86400 20220503055829 20220426044829 45728 net. kqtegTsTwSJ9OJ/4UpoKnOzaSfaEaSxd03SERi2nhwhL1Dd/xjXF+Oy+ gB2NxI8IHBdT0Za1PadKRYefjjI+phvYB2Z2s7LqLE5iLju+2R6mVMQu TfkTO8GJWxBDMcXdcX2cjTxSan7y8m4kbzeGvqFHwiWtodDnT2lFQBvg QKqFhOv3D/NZtRua5mWeuy78rB3MIZQmGQ7rwapaz4h4eg==\nGBMGFDMMHIENHS2RNSDAQ541H88GB5IO.net. 86400 IN NSEC3 1 1 0 - GBMKRB78QIII3C3NIFGFSK27G1IBHMM0 NS DS RRSIG\nGBMGFDMMHIENHS2RNSDAQ541H88GB5IO.net. 86400 IN RRSIG NSEC3 8 2 86400 20220430055643 20220423044643 45728 net. JIFFMnHeaG97gcZYao5JGWkTJ4zGKDAKrfLOi9KrKVmBroFmnjfOytBo NgTxIl17GlLW2kaq1doKHpDHUu8y4u/56OdJmeBgL+OYqGbQjmICztpK dU+p9eoXUPLMkDFTqrwFhN1dm51Q9sle4MiDHMeLHBrs76jlpBcR+PQn NO9LoUolBGhvxHSQfhwCyAi0slPURsAkC4DBUS1WrpipCQ==\n;; Received 1116 bytes from 192.26.92.30#53(c.gtld-servers.net) in 32 ms\n\ncdn.jsdelivr.net.\t900\tIN\tCNAME\tjsdelivr.map.fastly.net.\n;; Received 79 bytes from 185.136.98.122#53(gns3.cloudns.net) in 28 ms\n"
        }
      }
  ]
}
```

#### server

**key**: `Result.result.server`

**type**: `string`

IP Address of the resolver used.

#### time

**key**: `Result.result.time`

**type**: `number`

time it took to complete the request. Reported by `dig`.

#### answer[]

**key**: `Result.result.answer[]`

**type**: `Object[]`

An array of all returned DNS results.

#### answer[].domain

**key**: `Result.result.answer[].domain`

**type**: `string`

#### answer[].value

**key**: `Result.result.answer[].value`

**type**: `string`

reported record's value. Depending on type, it might be an IP Address, or plain text.

#### answer[].type

**key**: `Result.result.answer[].type`

**type**: `string`

record type.

#### answer[].ttl

**key**: `Result.result.answer[].ttl`

**type**: `string`

record ttl.

#### answer[].class

**key**: `Result.result.answer[].class`

**type**: `string`

record class code.
