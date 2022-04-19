# get probes

Get list of all probes connected to the server.

## request

**method**: `GET`

**url**: `/v1/probes`

### parameters

**query**: 
- `pretty` (optional) - prettifies the JSON response

## success response

**status code**: `200 OK`

### schema

```
[
    {
        version: string
        location: {
            continent: string
            region: string
            country: string
            state?: string
            city: string
            asn: number
            latitude: decimal
            longtitude: decimal
            network: string
        }
    }
]
```

### example

```
[
    {
        "version": "0.2.4",
        "location": {
            "continent": "NA",
            "region": "northern america",
            "country": "US",
            "state": "UT",
            "city": "salt lake city",
            "asn": 396982,
            "latitude": 40.7608,
            "longitude": -111.8911,
            "network": "google llc"
        }
    },
    {
        "version": "0.2.4",
        "location": {
            "continent": "AS",
            "region": "south eastern-asia",
            "country": "TH",
            "city": "bangkok",
            "asn": 45102,
            "latitude": 13.754,
            "longitude": 100.5014,
            "network": "alibaba china technology co. ltd."
        }
    }
]
```

## error response (500)

**status code**: `500 Internal Server Error`

```
{
    error: {
      "message": "Internal Server Error",
      "type": "api_error"
    }
}
```
