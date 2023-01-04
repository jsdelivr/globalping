# Measurement Response Schema

Jump to:
- [`Full success schema`](#success)
- [`Result schema`](#result)
- [`Ping Result schema`](#ping)
- [`Traceroute  Result schema`](#traceroute)
- [`DNS Result schema`](#dns)
- [`MTR Result schema`](#mtr)
- [`HTTP Result schema`](#http)

## Success

### schema

#### Id

**key**: `id`

**type**: `string`

Measurement Id number, obtained from [`POST /v1/measurements`](../post-create.md) request.

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
                "network": "amazon.com inc.",
                "tags": []
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
- [`mtr`](#mtr)
- [`http`](#http)

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

An array of all PING iterations before the deadline occurred.

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

An array of all traceroute iterations before the deadline occurred.

#### hops[].resolvedHostname

**key**: `Result.result.hops[].resolvedHostname`

**type**: `string`

reported hostname.

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

***warning!***: In case the measurement was requested with `toggle` enabled, the `Result.hops` will be of type `Object[]`. This is because each trace path is returned individually by the probe.

example:
```json
{
  "id": "RelHRYGX9yAYtI0b",
  "type": "dns",
  "status": "finished",
  "createdAt": "2022-07-17T16:19:52.909Z",
  "updatedAt": "2022-07-17T16:19:52.909Z",
  "results": [
    {
      "probe": {
        "continent": "EU",
        "region": "western europe",
        "country": "NL",
        "state": null,
        "city": "naarden",
        "asn": 33915,
        "longitude": 5.1563,
        "latitude": 52.285,
        "network": "ziggo",
        "tags": []
      },
      "result": {
        "hops": [
          {
            "answers": [
              {
                "name": ".",
                "type": "NS",
                "ttl": 362800,
                "class": "IN",
                "value": "a.root-servers.net."
              },
              ...
              {
                "name": ".",
                "type": "NS",
                "ttl": 362800,
                "class": "IN",
                "value": "m.root-servers.net."
              }
            ],
            "timings": {
              "total": 0
            },
            "resolver": "192.168.0.49"
          },
          ...
          {
            "answers": [
              {
                "name": "google.com.",
                "type": "A",
                "ttl": 300,
                "class": "IN",
                "value": "142.250.178.14"
              }
            ],
            "timings": {
              "total": 28
            },
            "resolver": "ns1.google.com"
          }
        ],
        "rawOutput": "\n; <<>> DiG 9.16.1-Ubuntu <<>> google.com -t A -p 53 -4 +timeout=3 +tries=2 +nocookie +trace\n;; global options: +cmd\n.\t\t\t362800\tIN\tNS\ta.root-servers.net.\n.\t\t\t362800\tIN\tNS\tb.root-servers.net.\n.\t\t\t362800\tIN\tNS\tc.root-servers.net.\n.\t\t\t362800\tIN\tNS\td.root-servers.net.\n.\t\t\t362800\tIN\tNS\te.root-servers.net.\n.\t\t\t362800\tIN\tNS\tf.root-servers.net.\n.\t\t\t362800\tIN\tNS\tg.root-servers.net.\n.\t\t\t362800\tIN\tNS\th.root-servers.net.\n.\t\t\t362800\tIN\tNS\ti.root-servers.net.\n.\t\t\t362800\tIN\tNS\tj.root-servers.net.\n.\t\t\t362800\tIN\tNS\tk.root-servers.net.\n.\t\t\t362800\tIN\tNS\tl.root-servers.net.\n.\t\t\t362800\tIN\tNS\tm.root-servers.net.\n;; Received 492 bytes from 192.168.0.49#53(192.168.0.49) in 0 ms\n\ncom.\t\t\t172800\tIN\tNS\te.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tb.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tj.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tm.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\ti.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tf.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\ta.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tg.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\th.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tl.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tk.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tc.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\td.gtld-servers.net.\ncom.\t\t\t86400\tIN\tDS\t30909 8 2 E2D3C916F6DEEAC73294E8268FB5885044A833FC5459588F4A9184CF C41A5766\ncom.\t\t\t86400\tIN\tRRSIG\tDS 8 1 86400 20220730050000 20220717040000 20826 . EioIIaaJd6MrRl24dvoN/uEZeTC99lAcUkOw8N2V0xYLvpzgjEqCTrav NL/hsoesQaqV4oEHAhaGLN3CqeD67/H3486F/qvsgzUr44+A3snPuSEY MII2V1pvqpoSS/CRFp/WeocdKNLvG8mJ3ZAj5940WkZz7kctpvjuUTU3 mrlNbNZ5L711Jfg+7cClnEwH4S0zYXIO2GKQ4ODJNu6AGqXJmnhAV/Kr V9eqgnlN0Jephc2yPyQOsuDLEaZktgQDKyJZdhVXOaKPyJ2kXjiEP54M jHPJSKsnhvm5Yzp3yZ0vs1/nUplwtot4EmBEspr8IURoopRmBKgTrpR7 jNBobg==\n;; Received 1170 bytes from 198.41.0.4#53(a.root-servers.net) in 16 ms\n\ngoogle.com.\t\t172800\tIN\tNS\tns2.google.com.\ngoogle.com.\t\t172800\tIN\tNS\tns1.google.com.\ngoogle.com.\t\t172800\tIN\tNS\tns3.google.com.\ngoogle.com.\t\t172800\tIN\tNS\tns4.google.com.\nCK0POJMG874LJREF7EFN8430QVIT8BSM.com. 86400 IN NSEC3 1 1 0 - CK0Q2D6NI4I7EQH8NA30NS61O48UL8G5 NS SOA RRSIG DNSKEY NSEC3PARAM\nCK0POJMG874LJREF7EFN8430QVIT8BSM.com. 86400 IN RRSIG NSEC3 8 2 86400 20220722042351 20220715031351 37269 com. CGDG1OnS2M4TfifTOQPoDPkONkkSyrgg/J0R9YJMr2DoNwWKDtAlkFCC w6Zudqnhww+ueLqL9JMXgveLaD9yz+DVWUG0bVQrjwXeOETE77TP2o1n Y0gI+grgHq2RnbCQQYwrQCP+y5uW60umtQjNJ5Jrn79GcF71310gEyqP ssKDXc+larXUFTX4ioVjhaNJmxAJ+1HMNOEx0mExixJSfA==\nS84BKCIBC38P58340AKVNFN5KR9O59QC.com. 86400 IN NSEC3 1 1 0 - S84BUO64GQCVN69RJFUO6LVC7FSLUNJ5 NS DS RRSIG\nS84BKCIBC38P58340AKVNFN5KR9O59QC.com. 86400 IN RRSIG NSEC3 8 2 86400 20220723051421 20220716040421 32298 com. Sa83wfjljiKv2sIWRuo38q0SO8Awm6Qeb1b5imsCWJFtKGi0O9peJOZH yeGkl83IhLXdNNpxIHDl4FylvNHtUK1lLouSLZ6mEArRSTHftmyVsCX4 QXnmgIRsnYxNkdT73ROC0XJKwDY7yugRu+atn3sxKgWT2Ix6akhxVYfZ 0hATnASS1+vgRlgI577xRFkwaz2bKk/uq6P+PghDiSox+Q==\n;; Received 836 bytes from 192.26.92.30#53(c.gtld-servers.net) in 104 ms\n\ngoogle.com.\t\t300\tIN\tA\t142.250.178.14\n;; Received 55 bytes from 216.239.32.10#53(ns1.google.com) in 28 ms\n"
      }
    }
  ]}
}
```

#### resolver

**key**: `Result.result.resolver`

**type**: `string`

IP Address of the resolver used.

#### timings

**key**: `Result.result.timings`

**type**: `Object`

stats container object, containing all timings details.

#### timings.total

**key**: `Result.result.timings.total`

**type**: `number`

time it took to complete the request. Reported by `dig`.

#### answers[]

**key**: `Result.result.answers[]`

**type**: `Object[]`

An array of all returned DNS results.

#### answer[].name

**key**: `Result.result.answer[].name`

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
                "network": "terrahost",
                "tags": []
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
                        "timings":
                        [
                            {
                                "rtt": 0.294
                            },
                            {
                                "rtt": 0.199
                            },
                            {
                                "rtt": 0.227
                            }
                        ],
                        "duplicate": false,
                        "asn": [56655],
                        "resolvedAddress": "195.16.73.1",
                        "resolvedHostname": "static.195.16.73.1.terrahost.com"
                    },
                    ...
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

#### hops[].resolvedHostname

**key**: `Result.result.hops[].resolvedHostname`

**type**: `string`

#### hops[].resolvedAddress

**key**: `Result.result.hops[].resolvedAddress`

**type**: `string`

#### hops[].asn

**key**: `Result.result.hops[].asn`

**type**: `number[]`

An array, containing AS numbers assigned to this IP Address.

#### hops[].timings[]

**key**: `Result.result.hops[].timings[]`

**type**: `Object[]`

An array of all ping records.

#### hops[].timings[].rtt

**key**: `Result.result.hops[].timings[].rtt`

**type**: `number | null`

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

### HTTP

example:

```json
{
  "id": "EXrIBBoduJUCcJRa",
  "type": "http",
  "status": "finished",
  "createdAt": 1658480890820,
  "updatedAt": 1658480891219,
  "results": [
    {
      "probe": {
        "continent": "NA",
        "region": "northern america",
        "country": "CA",
        "state": null,
        "city": "toronto",
        "asn": 396982,
        "longitude": -79.4163,
        "latitude": 43.7001,
        "network": "google cloud",
        "tags": [],
      },
      "result": {
        "resolvedAddress": "142.250.178.14",
        "headers": {
          "location": "https://www.google.com/",
          "content-type": "text/html; charset=UTF-8",
          "date": "Fri, 22 Jul 2022 09:08:11 GMT",
          "expires": "Sun, 21 Aug 2022 09:08:11 GMT",
          "cache-control": "public, max-age=2592000",
          "server": "gws",
          "content-length": "220",
          "x-xss-protection": "0",
          "x-frame-options": "SAMEORIGIN",
          "connection": "close"
        },
        "rawHeaders": "Location: https://www.google.com/\nContent-Type: text/html; charset=UTF-8\nDate: Fri, 22 Jul 2022 09:08:11 GMT\nExpires: Sun, 21 Aug 2022 09:08:11 GMT\nCache-Control: public, max-age=2592000\nServer: gws\nContent-Length: 220\nX-XSS-Protection: 0\nX-Frame-Options: SAMEORIGIN\nConnection: close",
        "rawBody": "",
        "statusCode": 301,
        "timings": {
          "firstByte": 131,
          "dns": 3,
          "tls": 27,
          "tcp": 1,
          "total": 163,
          "download": 1
        },
        "tls": {
          "authorized": true,
          "createdAt": "Jun 27 08:17:39 2022 GMT",
          "expireAt": "Sep 19 08:17:38 2022 GMT",
          "issuer": {
            "C": "US",
            "O": "Google Trust Services LLC",
            "CN": "GTS CA 1C3"
          },
          "subject": {
            "CN": "*.google.com",
            "alt": "DNS:*.google.com, DNS:*.appengine.google.com, DNS:*.bdn.dev, DNS:*.cloud.google.com, DNS:*.crowdsource.google.com, DNS:*.datacompute.google.com, DNS:*.google.ca, DNS:*.google.cl, DNS:*.google.co.in, DNS:*.google.co.jp, DNS:*.google.co.uk, DNS:*.google.com.ar, DNS:*.google.com.au, DNS:*.google.com.br, DNS:*.google.com.co, DNS:*.google.com.mx, DNS:*.google.com.tr, DNS:*.google.com.vn, DNS:*.google.de, DNS:*.google.es, DNS:*.google.fr, DNS:*.google.hu, DNS:*.google.it, DNS:*.google.nl, DNS:*.google.pl, DNS:*.google.pt, DNS:*.googleadapis.com, DNS:*.googleapis.cn, DNS:*.googlevideo.com, DNS:*.gstatic.cn, DNS:*.gstatic-cn.com, DNS:googlecnapps.cn, DNS:*.googlecnapps.cn, DNS:googleapps-cn.com, DNS:*.googleapps-cn.com, DNS:gkecnapps.cn, DNS:*.gkecnapps.cn, DNS:googledownloads.cn, DNS:*.googledownloads.cn, DNS:recaptcha.net.cn, DNS:*.recaptcha.net.cn, DNS:recaptcha-cn.net, DNS:*.recaptcha-cn.net, DNS:widevine.cn, DNS:*.widevine.cn, DNS:ampproject.org.cn, DNS:*.ampproject.org.cn, DNS:ampproject.net.cn, DNS:*.ampproject.net.cn, DNS:google-analytics-cn.com, DNS:*.google-analytics-cn.com, DNS:googleadservices-cn.com, DNS:*.googleadservices-cn.com, DNS:googlevads-cn.com, DNS:*.googlevads-cn.com, DNS:googleapis-cn.com, DNS:*.googleapis-cn.com, DNS:googleoptimize-cn.com, DNS:*.googleoptimize-cn.com, DNS:doubleclick-cn.net, DNS:*.doubleclick-cn.net, DNS:*.fls.doubleclick-cn.net, DNS:*.g.doubleclick-cn.net, DNS:doubleclick.cn, DNS:*.doubleclick.cn, DNS:*.fls.doubleclick.cn, DNS:*.g.doubleclick.cn, DNS:dartsearch-cn.net, DNS:*.dartsearch-cn.net, DNS:googletraveladservices-cn.com, DNS:*.googletraveladservices-cn.com, DNS:googletagservices-cn.com, DNS:*.googletagservices-cn.com, DNS:googletagmanager-cn.com, DNS:*.googletagmanager-cn.com, DNS:googlesyndication-cn.com, DNS:*.googlesyndication-cn.com, DNS:*.safeframe.googlesyndication-cn.com, DNS:app-measurement-cn.com, DNS:*.app-measurement-cn.com, DNS:gvt1-cn.com, DNS:*.gvt1-cn.com, DNS:gvt2-cn.com, DNS:*.gvt2-cn.com, DNS:2mdn-cn.net, DNS:*.2mdn-cn.net, DNS:googleflights-cn.net, DNS:*.googleflights-cn.net, DNS:admob-cn.com, DNS:*.admob-cn.com, DNS:*.gstatic.com, DNS:*.metric.gstatic.com, DNS:*.gvt1.com, DNS:*.gcpcdn.gvt1.com, DNS:*.gvt2.com, DNS:*.gcp.gvt2.com, DNS:*.url.google.com, DNS:*.youtube-nocookie.com, DNS:*.ytimg.com, DNS:android.com, DNS:*.android.com, DNS:*.flash.android.com, DNS:g.cn, DNS:*.g.cn, DNS:g.co, DNS:*.g.co, DNS:goo.gl, DNS:www.goo.gl, DNS:google-analytics.com, DNS:*.google-analytics.com, DNS:google.com, DNS:googlecommerce.com, DNS:*.googlecommerce.com, DNS:ggpht.cn, DNS:*.ggpht.cn, DNS:urchin.com, DNS:*.urchin.com, DNS:youtu.be, DNS:youtube.com, DNS:*.youtube.com, DNS:youtubeeducation.com, DNS:*.youtubeeducation.com, DNS:youtubekids.com, DNS:*.youtubekids.com, DNS:yt.be, DNS:*.yt.be, DNS:android.clients.google.com, DNS:developer.android.google.cn, DNS:developers.android.google.cn, DNS:source.android.google.cn"
          }
        },
        "rawOutput": "HTTP/1.1 301\nLocation: https://www.google.com/\nContent-Type: text/html; charset=UTF-8\nDate: Fri, 22 Jul 2022 09:08:11 GMT\nExpires: Sun, 21 Aug 2022 09:08:11 GMT\nCache-Control: public, max-age=2592000\nServer: gws\nContent-Length: 220\nX-XSS-Protection: 0\nX-Frame-Options: SAMEORIGIN\nConnection: close"
      }
    }
  ]
}
```
#### resolvedAddress

**key**: `Result.result.resolvedAddress`

**type**: `string`

#### rawHeaders

**key**: `Result.result.rawHeaders`

**type**: `string`

Unparsed response headers.

#### Headers

**key**: `Result.result.headers`

**type**: `Object<string, string>`

JSON parsed resposne headers.

#### rawBody

**key**: `Result.result.rawBody`

**type**: `string`

Unparsed response body.

#### statusCode

**key**: `Result.result.statusCode`

**type**: `integer`

#### timings

**key**: `Result.result.timings`

**type**: `Object<string, integer>`

A full breakdown of how long it took to complete the request.

#### timings.firstByte / timings.dns / timings.tls / timings.tcp / timings.download / timings.total

**key**:
`Result.result.timings.firstByte` `Result.result.timings.dns` `Result.result.timings.tls` `Result.result.timings.tcp` `Result.result.timings.download` `Result.result.timings.total`

**type**: `integer`

**warning**:
HTTP2 requests might be lacknig `dns`, `tls` and `tcp` data.

#### tls

**key**: `Result.result.tls`

**type**: `Object<string, any>`

#### tls.authorized

**key**: `Result.result.tls.authorized`

**type**: `boolean`

#### tls.authorizationError

**key**: `Result.result.tls.authorizationError`

**type**: `string`

An error message describing the unsuccessful TLS authorization.

#### tls.createdAt / tls.updatedAt

**key**: `Result.result.tls.createdAt` `Result.result.tls.updatedAt`

**type**: `string` (ISO)

#### issuer

**key**: `Result.result.tls.issuer`

**type**: `Object<string, string>`

#### issuer.C

**key**: `Result.result.tls.issuer.C`

**type**: `string`

Issuer's registration country

#### issuer.ST

**key**: `Result.result.tls.issuer.ST`

**type**: `string`

Issuer's registration state (US)

#### issuer.L

**key**: `Result.result.tls.issuer.L`

**type**: `string`

Issuer's registration city

#### issuer.O

**key**: `Result.result.tls.issuer.O`

**type**: `string`

Issuer's registration organization

#### issuer.CN

**key**: `Result.result.tls.issuer.CN`

**type**: `string`

Issuer's organization common name

#### subject

**key**: `Result.result.tls.suject`

**type**: `Object<string, string>`

#### subject.C

**key**: `Result.result.tls.suject.C`

**type**: `string`

Subject's registration country

#### subject.ST

**key**: `Result.result.tls.suject.ST`

**type**: `string`

Subject's registration state (US)

#### subject.L

**key**: `Result.result.tls.suject.L`

**type**: `string`

Subject's registration city

#### subjects.O

**key**: `Result.result.tls.subject.O`

**type**: `string`

Subjects's registration organization


#### subject.CN

**key**: `Result.result.tls.subject.CN`

**type**: `string`

Subject's name (FQDN)

#### subject.alt

**key**: `Result.result.tls.subject.alt`

**type**: `string`

A list of alternative names (FQDN) associated with this certificate. Each record is prefixed with `DNS:`, and seperated with comma (`,`).

