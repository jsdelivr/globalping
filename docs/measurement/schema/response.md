# Measurement Response Schema

Jump to:
- [`Full success schema`](#success)
- [`Result schema`](#result)
- [`Ping Result schema`](#ping)
- [`Traceroute  Result schema`](#traceroute)
- [`DNS Result schema`](#dns)
- [`MTR Result schema`](#mtr)

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
- `mtr`

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
                "resolvedHostname": "lhr25s33-in-f14.1e100.net",
                "timings": [
                    {
                        "ttl": 108,
                        "rtt": 16.5
                    },
                    {
                        "ttl": 108,
                        "rtt": 16.5
                    },
                    {
                        "ttl": 108,
                        "rtt": 16.5
                    }
                ],
                "stats": {
                  "min": 16.474,
                  "avg": 16.504,
                  "max": 16.543,
                  "loss": 0,
                },
                "rawOutput": "PING google.com (172.217.170.14) 56(84) bytes of data.\n64 bytes from lhr25s33-in-f14.1e100.net (172.217.170.14): icmp_seq=1 ttl=108 time=16.5 ms\n64 bytes from lhr25s33-in-f14.1e100.net (172.217.170.14): icmp_seq=2 ttl=108 time=16.5 ms\n64 bytes from lhr25s33-in-f14.1e100.net (172.217.170.14): icmp_seq=3 ttl=108 time=16.5 ms\n\n--- google.com ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, time 402ms\nrtt min/avg/max/mdev = 16.474/16.504/16.543/0.028 ms"
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

#### resolvedHostname

**key**: Result.result.resolvedHostname`

**type**: `string`

Hostname address contained within `ping` response header.

#### stats

A container object for test stats.

**key**: `Result.result.stats`

**type**: `Object`

#### stats.loss

**key**: `Result.result.stats.loss`

**type**: `number`

total count of lost packets.

#### stats.min / stats.avg / stats.max

**key**: `Result.result.stats.min` `Result.result.stats.avg` `Result.result.stats.max`

**type**: `number`

stats in millisecond contained within `ping` response footer.

#### timings[]

**key**: `Result.result.timings[]`

**type**: `Object[]`

An array of all PING iterations before the deadline occured.

#### timings[].ttl

**key**: `Result.result.timings[].ttl`

**type**: `number`

#### timings[].time

**key**: `Result.result.timings[].time`

**type**: `number`

### TRACEROUTE

#### resolvedAddress

**key**: Result.result.resolvedAddress`

**type**: `string`

IP Address contained within `traceroute` response header.

#### resolvedHostname

**key**: Result.result.resolvedHostname`

**type**: `string`

Hostname address contained within `traceroute` response header.

#### hops[]

**key**: `Result.result.hops[]`

**type**: `Object[]`

An array of all traceroute iterations before the deadline occured.

#### hops[].resolvedHostname

**key**: `Result.result.hops[].resolvedHostname`

**type**: `string`

reported hostame.

#### hops[].resolvedAddress

**key**: `Result.result.hops[].resolvedAddress`

**type**: `string`

reported ip address.

#### hops[].timings[]

**key**: `Result.result.hops[].timings[]`

**type**: `Object[]`

#### hops[].timings[].rtt

**key**: `Result.result.times[].rtt`

**type**: `number`

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

### MTR

example:

```json
{
    "id": "aAizKkYaSuXyUx0r",
    "type": "mtr",
    "status": "finished",
    "createdAt": "2022-07-17T16:19:52.909Z",
    "updatedAt": "2022-07-17T16:19:52.909Z",
    "results":
    [
        {
            "probe":
            {
                "continent": "AF",
                "region": "western africa",
                "country": "NG",
                "state": null,
                "city": "lagos",
                "asn": 56655,
                "longitude": 3.41,
                "latitude": 6.49,
                "network": "terrahost"
            },
            "result":
            {
                "hops":
                [
                    {
                        "stats":
                        {
                            "min": 0.199,
                            "max": 0.294,
                            "avg": 0.2,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0.1,
                            "jMin": 0.1,
                            "jMax": 0.2,
                            "jAvg": 0.2
                        },
                        "times":
                        [
                            {
                                "seq": "33000",
                                "time": 0.294
                            },
                            {
                                "seq": "33013",
                                "time": 0.199
                            },
                            {
                                "seq": "33023",
                                "time": 0.227
                            }
                        ],
                        "host": "195.16.73.1",
                        "duplicate": false,
                        "asn": "56655",
                        "resolvedHost": "static.195.16.73.1.terrahost.com"
                    },
                    {
                        "stats":
                        {
                            "min": 0.873,
                            "max": 1.043,
                            "avg": 1,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0.1,
                            "jMin": 0.1,
                            "jMax": 0.9,
                            "jAvg": 0.5
                        },
                        "times":
                        [
                            {
                                "seq": "33001",
                                "time": 0.954
                            },
                            {
                                "seq": "33014",
                                "time": 1.043
                            },
                            {
                                "seq": "33024",
                                "time": 0.873
                            }
                        ],
                        "host": "196.216.148.25",
                        "duplicate": false
                    },
                    {
                        "stats":
                        {
                            "min": 1.205,
                            "max": 1.313,
                            "avg": 1.3,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0.1,
                            "jMin": 0,
                            "jMax": 1.2,
                            "jAvg": 0.6
                        },
                        "times":
                        [
                            {
                                "seq": "33002",
                                "time": 1.313
                            },
                            {
                                "seq": "33015",
                                "time": 1.269
                            },
                            {
                                "seq": "33025",
                                "time": 1.205
                            }
                        ],
                        "host": "108.170.240.34",
                        "duplicate": false,
                        "asn": "15169",
                        "resolvedHost": "108.170.240.34"
                    },
                    {
                        "stats":
                        {
                            "min": 76.561,
                            "max": 76.779,
                            "avg": 76.7,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0.1,
                            "jMin": 0.1,
                            "jMax": 76.8,
                            "jAvg": 38.4
                        },
                        "times":
                        [
                            {
                                "seq": "33003",
                                "time": 76.621
                            },
                            {
                                "seq": "33016",
                                "time": 76.561
                            },
                            {
                                "seq": "33026",
                                "time": 76.779
                            }
                        ],
                        "host": "142.251.50.69",
                        "duplicate": false,
                        "asn": "15169",
                        "resolvedHost": "142.251.50.69"
                    },
                    {
                        "stats":
                        {
                            "min": 94.791,
                            "max": 95.724,
                            "avg": 95.2,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0.4,
                            "jMin": 0.7,
                            "jMax": 94.8,
                            "jAvg": 47.7
                        },
                        "times":
                        [
                            {
                                "seq": "33004",
                                "time": 95.724
                            },
                            {
                                "seq": "33017",
                                "time": 95.031
                            },
                            {
                                "seq": "33027",
                                "time": 94.791
                            }
                        ],
                        "host": "142.251.226.177",
                        "duplicate": false,
                        "asn": "15169",
                        "resolvedHost": "142.251.226.177"
                    },
                    {
                        "stats":
                        {
                            "min": 104.574,
                            "max": 104.771,
                            "avg": 104.7,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0.1,
                            "jMin": 0,
                            "jMax": 104.6,
                            "jAvg": 52.3
                        },
                        "times":
                        [
                            {
                                "seq": "33005",
                                "time": 104.771
                            },
                            {
                                "seq": "33018",
                                "time": 104.731
                            },
                            {
                                "seq": "33028",
                                "time": 104.574
                            }
                        ],
                        "host": "142.251.232.224",
                        "duplicate": false,
                        "asn": "15169",
                        "resolvedHost": "142.251.232.224"
                    },
                    {
                        "stats":
                        {
                            "min": 105.795,
                            "max": 105.823,
                            "avg": 105.8,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0,
                            "jMin": 0,
                            "jMax": 105.8,
                            "jAvg": 52.9
                        },
                        "times":
                        [
                            {
                                "seq": "33006",
                                "time": 105.823
                            },
                            {
                                "seq": "33019",
                                "time": 105.802
                            },
                            {
                                "seq": "33029",
                                "time": 105.795
                            }
                        ],
                        "host": "142.251.232.223",
                        "duplicate": false,
                        "asn": "15169",
                        "resolvedHost": "142.251.232.223"
                    },
                    {
                        "stats":
                        {
                            "min": 102.795,
                            "max": 102.862,
                            "avg": 102.8,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0,
                            "jMin": 0,
                            "jMax": 102.9,
                            "jAvg": 51.4
                        },
                        "times":
                        [
                            {
                                "seq": "33007",
                                "time": 102.795
                            },
                            {
                                "seq": "33020",
                                "time": 102.828
                            },
                            {
                                "seq": "33030",
                                "time": 102.862
                            }
                        ],
                        "host": "74.125.242.97",
                        "duplicate": false,
                        "asn": "15169",
                        "resolvedHost": "74.125.242.97"
                    },
                    {
                        "stats":
                        {
                            "min": 101.633,
                            "max": 101.756,
                            "avg": 101.7,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0.1,
                            "jMin": 0.1,
                            "jMax": 101.6,
                            "jAvg": 50.9
                        },
                        "times":
                        [
                            {
                                "seq": "33008",
                                "time": 101.645
                            },
                            {
                                "seq": "33021",
                                "time": 101.756
                            },
                            {
                                "seq": "33031",
                                "time": 101.633
                            }
                        ],
                        "host": "108.170.234.231",
                        "duplicate": false,
                        "asn": "15169",
                        "resolvedHost": "108.170.234.231"
                    },
                    {
                        "stats":
                        {
                            "min": 101.957,
                            "max": 101.981,
                            "avg": 102,
                            "total": 3,
                            "rcv": 3,
                            "drop": 0,
                            "stDev": 0,
                            "jMin": 0,
                            "jMax": 102,
                            "jAvg": 51
                        },
                        "times":
                        [
                            {
                                "seq": "33009",
                                "time": 101.965
                            },
                            {
                                "seq": "33022",
                                "time": 101.957
                            },
                            {
                                "seq": "33032",
                                "time": 101.981
                            }
                        ],
                        "host": "142.250.200.14",
                        "duplicate": false,
                        "resolvedHost": "lhr48s29-in-f14.1e100.net",
                        "asn": "15169"
                    },
                    {
                        "stats":
                        {
                            "min": 101.953,
                            "max": 101.953,
                            "avg": 102,
                            "total": 1,
                            "rcv": 1,
                            "drop": 0,
                            "stDev": 0,
                            "jMin": 102,
                            "jMax": 102,
                            "jAvg": 102
                        },
                        "times":
                        [
                            {
                                "seq": "33010",
                                "time": 101.953
                            }
                        ],
                        "host": "142.250.200.14",
                        "duplicate": true,
                        "resolvedHost": "lhr48s29-in-f14.1e100.net",
                        "asn": "15169"
                    },
                    {
                        "stats":
                        {
                            "min": 101.945,
                            "max": 101.945,
                            "avg": 101.9,
                            "total": 1,
                            "rcv": 1,
                            "drop": 0,
                            "stDev": 0,
                            "jMin": 101.9,
                            "jMax": 101.9,
                            "jAvg": 101.9
                        },
                        "times":
                        [
                            {
                                "seq": "33011",
                                "time": 101.945
                            }
                        ],
                        "host": "142.250.200.14",
                        "duplicate": true,
                        "resolvedHost": "lhr48s29-in-f14.1e100.net",
                        "asn": "15169"
                    },
                    {
                        "stats":
                        {
                            "min": 101.961,
                            "max": 101.961,
                            "avg": 102,
                            "total": 1,
                            "rcv": 1,
                            "drop": 0,
                            "stDev": 0,
                            "jMin": 102,
                            "jMax": 102,
                            "jAvg": 102
                        },
                        "times":
                        [
                            {
                                "seq": "33012",
                                "time": 101.961
                            }
                        ],
                        "host": "142.250.200.14",
                        "duplicate": true,
                        "resolvedHost": "lhr48s29-in-f14.1e100.net",
                        "asn": "15169"
                    }
                ],
                "rawOutput": "Host                                                             Loss% Drop Rcv   Avg  StDev  Javg \n 1. AS56655 _gateway (195.16.73.1)                                0.0%    0   3   0.2    0.1   0.2\n 2. AS???   196.216.148.25 (196.216.148.25)                       0.0%    0   3   1.0    0.1   0.5\n 3. AS15169 108.170.240.34 (108.170.240.34)                       0.0%    0   3   1.3    0.1   0.6\n 4. AS15169 142.251.50.69 (142.251.50.69)                         0.0%    0   3  76.7    0.1  38.4\n 5. AS15169 142.251.226.177 (142.251.226.177)                     0.0%    0   3  95.2    0.4  47.7\n 6. AS15169 142.251.232.224 (142.251.232.224)                     0.0%    0   3 104.7    0.1  52.3\n 7. AS15169 142.251.232.223 (142.251.232.223)                     0.0%    0   3 105.8    0.0  52.9\n 8. AS15169 74.125.242.97 (74.125.242.97)                         0.0%    0   3 102.8    0.0  51.4\n 9. AS15169 108.170.234.231 (108.170.234.231)                     0.0%    0   3 101.7    0.1  50.9\n10. AS15169 lhr48s29-in-f14.1e100.net (142.250.200.14)            0.0%    0   3 102.0    0.0  51.0\n",

            }
        }
    ]
}
```
#### hops[]

**key**: `Result.result.hops[]`

**type**: `Object[]`

An array of all returned MTR results.

#### hops[].resolvedHost

**key**: `Result.result.hops[].resolvedHost`

**type**: `string`

#### hops[].host

**key**: `Result.result.hops[].host`

**type**: `string`

Server's IP Address.

#### hops[].asn

**key**: `Result.result.hops[].asn`

**type**: `string`

AS number of the hop server.

#### hops[].times[]

**key**: `Result.result.hops[].times[]`

**type**: `Object[]`

An array of all ping records.

#### hops[].times[].seq

**key**: `Result.result.hops[].times[].seq`

**type**: `number`

MTR Ping sequence ID.

#### hops[].times[].time

**key**: `Result.result.hops[].times[].time`

**type**: `number|undefined`

Ping response time.

#### hops[].stats

**key**: `Result.result.hops[].stats`

**type**: `Object`

A stats summary of ping responses.

#### hops[].stats.min

**key**: `Result.result.hops[].stats.min`

**type**: `float`

The lowest response time.

#### hops[].stats.max

**key**: `Result.result.hops[].stats.max`

**type**: `float`

The longest response time.

#### hops[].stats.avg

**key**: `Result.result.hops[].stats.avg`

**type**: `float`

The average response time.

#### hops[].stats.total

**key**: `Result.result.hops[].stats.total`

**type**: `number`

The total count of PING packets sent.

#### hops[].stats.rcv

**key**: `Result.result.hops[].stats.rcv`

**type**: `number`

The total count of PING responses.

#### hops[].stats.drop

**key**: `Result.result.hops[].stats.drop`

**type**: `number`

The total count of PING packets, to which response never came.

#### hops[].stats.stDev

**key**: `Result.result.hops[].stats.stDev`

**type**: `float`

standard deviation

#### hops[].stats.jMin

**key**: `Result.result.hops[].stats.jMin`

**type**: `float`

The lowest jitter between response times.

#### hops[].stats.jMax

**key**: `Result.result.hops[].stats.jMax`

**type**: `float`

The largest jitter between response times.

#### hops[].stats.jAvg

**key**: `Result.result.hops[].stats.jAvg`

**type**: `float`

The average jitter between response times.
