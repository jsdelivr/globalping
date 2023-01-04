# post measurement

Creates an on-demand measurement to run immediately.

## request

**method**: `POST`

**url**: `/v1/measurements`

### parameters

**headers**:
- `content-type: application/json` (required)

**body**:

schema:

below is presented a schema containing all possible input values; some are general, while others are utilised by a specific query type. Please, consult the [SCHEMA GUIDE](./schema/request.md) for a more detailed description.
```
{
    limit: number
    locations: Locations[]
    type: string
    target: string
    measurementOptions: {
        query?: {
            type?: string
        }
        request?: {
            headers?: Object<string, string>
            path?: string
            host?: string
            query?: string
            method?: string
        }
        protocol?: string
        port?: number
        resolver?: string
        trace?: boolean
        protocol?: string
        packets?: number
    }
}
```
example:
```json
POST https://api.globalping.io/v1/measurements
{
    "target": "jsdelivr.com",
    "type": "ping"
    "measurementOptions": {
        "packets": 10,
    },
    "limit": 10,
    "locations": [
        { "country": "gb" }
    ]
}
```
for `Locations` schema, please see [LOCATION SCHEMA](./schema/location.md).

## success response

**status code**: `202 Accepted`

**content**: response will contain an Id number of your measurement, and total number of probes assigned to your query. The count of assigned probes might vary from what you requested. A URL pointing to the measurement status is sent in the `Location` header.

### schema

```
{
    id: string,
    probesCount: number,
}
```

### example

```json
POST https://api.globalping.io/v1/measurements
{
    "id": "PY5fMsREMmIq45VR",
    "probesCount": 1,
}
```

headers:

```
  Location: https://api.globalping.io/v1/measurements/PY5fMsREMmIq45VR
```

## error response (no probes found)

**condition**: if provided location doesn't have probes - e.g. `{ locations: [ 'magic': 'not a real place' ] }`

**status code**: `422 Unprocessable Entity`

```json
{
    "error": {
      "message": "No suitable probes found",
      "type": "no_probes_found"
    }
}
```

## error response (validation failed)

**condition**: if provided data doesn't match the schema - e.g. mismatching `target` format.

**status code**: `400 Bad Request`

### schema

```
{
    error: {
        message: string
        type: string
        params: {
            [key: string]: string
        }
    }
}
```

### example

```json
{
    "error": {
        "message": "Validation Failed",
        "type": "validation_error",
        "params": {
            "measurement": "\"measurement\" does not match any of the allowed types"
        }
    }
}
```

## error response (500)

**condition**: unknown or internal error occurred

**status code**: `500 Internal Server Error`

```json
{
    "error": {
      "message": "Internal Server Error",
      "type": "api_error"
    }
}
```

## notes
- The measurement Id number is non retrievable.
- The measurement Id number can be used to fetch the query result.
- Measurements are kept for up-to full 7 days.
