# post measurement

Creates an on-demand measurement to run immediately.

## request

**method**: `POST`

**url**: `/v1/measurements`

### parameters

**headers**:
- `content-type: application/json` (required)

**query**: 
- `pretty` (optional) - prettifies the JSON response

**body**:

schema:

below is presented a schema containing all possible input values; some are general, while others are utilised by a specific query type. Please, consult the [SCHEMA GUIDE](./schema/request.md) for a more detailed description.
```
{
    limit: number
    locations: Locations[],
    measurement: {
        query?: {
            protocol?: string
            type?: string
            resolver?: string
            trace?: boolean
        }
        port?: number
        protocol?: string
        packets?: number
        target: string
        type: string
    }
}
```
example:
```json
POST https://api.globalping.io/v1/measurements/
{
    "limit": 10,
    "locations": [
        { "country": "gb" }
    ],
    "measurement": {
        "packets": 10,
        "target": "jsdelivr.com",
        "type": "ping"
    }
}
```
for `Locations` schema, please see [LOCATION SCHEMA](./schema/location.md).

## success response

**status code**: `200 OK`

**content**: response will contain an Id number of your measurement, and total number of probes assigned to your query. The count of assigned probes might vary from what you requested.

### schema

```
{
    id: string,
    probesCount: number
}
```

### example

```json
POST https://api.globalping.io/v1/measurements/
{
    "id": "PY5fMsREMmIq45VR",
    "probesCount": 1
}
```

## error response (validation failed)

**condition**: if provided data doesn't match the schema - e.g. mismatching `target` format.

**status code**: `422 Unprocessable Entity`

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
        "type": "invalid_request_error",
        "params": {
            "measurement": "\"measurement\" does not match any of the allowed types"
        }
    }
}
```

## error response (500)

**condition**: unknown or internal error occured

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
