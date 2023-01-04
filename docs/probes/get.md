# get probes

Get list of all probes currently online and connected to the API server.

## request

**method**: `GET`

**url**: `/v1/probes`

## success response

**status code**: `200 OK`

### schema

```
[
    {
        version: string
        ready: boolean
        location: {
            continent: string
            region: string
            country: string
            state?: string
            city: string
            asn: number
            latitude: decimal
            longitude: decimal
            network: string
        }
        tags: string[]
        resolvers: string[]
    }
]
```

### example

```json
GET https://api.globalping.io/v1/probes
[
    {
        "version": "0.10.1",
        "ready": true,
        "location": {
            "continent": "EU",
            "region": "Western Europe",
            "country": "BE",
            "city": "Brussels",
            "asn": 396982,
            "latitude": 50.8505,
            "longitude": 4.3488,
            "network": "Google LLC"
        },
        "tags": [
            "gcp-europe-west1"
        ],
        "resolvers": [
            "private"
        ]
    },
    {
        "version": "0.10.1",
        "ready": true,
        "location": {
            "continent": "EU",
            "region": "Northern Europe",
            "country": "IE",
            "city": "Dublin",
            "asn": 16509,
            "latitude": 53.3331,
            "longitude": -6.2489,
            "network": "Amazon.com, Inc."
        },
        "tags": [
            "aws-eu-west-1"
        ],
        "resolvers": [
            "private"
        ]
    }
]
```

## error response (500)

**status code**: `500 Internal Server Error`

```json
{
    "error": {
      "message": "Internal Server Error",
      "type": "api_error"
    }
}
```
