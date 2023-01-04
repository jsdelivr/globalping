# get measurement

Get the current state of the measurement.

## request

**method**: `GET`

**url**: `/v1/measurements/:id`

### parameters

**params**:
- `:id` - Id of the measurement request. Returned by [POST /v1/measurements](./post-create.md)

## success response

**status code**: `200 OK`

**content**: response will contain results from all requested probes, alongside some basic metadata of the request. For more detailed schema description, please follow the guide on [MEASUREMENT RESPONSE SCHEMA](./schema/response.md)

### schema

```
[
    {
        id: string
        type: string
        status: string
        createdAt: number
        updatedAt: number
        probesCount: number
        results: Result[]
    }
]
```

### example

```json
GET https://api.globalping.io/v1/measurements/tEaUg3vYnOu2exVC

{
    "id": "tEaUg3vYnOu2exVC",
    "type": "ping",
    "status": "finished",
    "createdAt": 1650384403719,
    "updatedAt": 1650384404482,
    "probesCount": 1,
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
                "tags": ["af-south-1"]
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

## error response (404)

**condition**: requested measurement was not found in the database.

**status code**: `404 Not Found`

```
(no body)
```

## error response (500)

**condition**: unknown or internal error occurred.

**status code**: `500 Internal Server Error`

```json
{
    "error": {
      "message": "Internal Server Error",
      "type": "api_error"
    }
}
```
