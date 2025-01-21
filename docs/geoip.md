# Geo IP algorithm

Input:
- ip adress of a probe

Output:
- location information about the ip

### Step 1

Currently we have 5 geo ip info providers: "ipinfo", "ip2location", "maxmind", "ipmap", "fastly". We pass the ip to every and get data from each of them (error or not found results are filtered out).

New data state:
```js
{
  "ipinfo": {
    "country": "US",
    "city": "Cupertino",
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
  "ip2location": {
    "country": "US",
    "city": "Long Beach",
    "lat": 33.790287,
    "long": -118.193769,
    "asn": "0002"
  },
  "maxmind": {
    "country": "US",
    "city": "Los Angeles",
    "lat": 34.0544,
    "long": -118.2441,
    "asn": "0003"
  },
  "ipmap": {
    "country": "US",
    "city": "Santa Clara",
    "lat": 37.3541,
    "long": -121.9552,
    "asn": "0004"
  },
  "fastly": {
    "country": "US",
    "city": "San Jose",
    "lat": 36.837866,
    "long": -123.341544,
    "asn": "0005"
  },
}
```

### Step 2

Apply city approximation. For every provider we are checking if it's city field value is in the [DC cities list](../src/lib/geoip/dc-cities.json).

If value is in the list, then city approximation is not required and city value from provider is kept.

Otherwise, we are applying city approximation:
- searching in geonames db in radius of 30 km using lat/long value from provider;
- filtering the result cities to be in same country as the provider's one;
- if there are multiple cities we are choosing city with the biggest population;
- result is an approximated city, it is written to the provider's "city" field;
- if no approximated city was found provider's original value is kept.

New data state:
```js
{
  "ipinfo": {
    "country": "US",
    "city": "San Jose", // provider's "Cupertino" city is not in the DC cities list and approximated city is "San Jose", so "San Jose" is a new city value
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
  "ip2location": {
    "country": "US",
    "city": "Los Angeles", // provider's "Long Beach" city is not in the DC cities list and approximated city is "Los Angeles", so "Los Angeles" is a new city value
    "lat": 33.790287,
    "long": -118.193769,
    "asn": "0002"
  },
  "maxmind": {
    "country": "US",
    "city": "Los Angeles", // provider's "Los Angeles" city is in the DC cities list so that value is kept
    "lat": 34.0544,
    "long": -118.2441,
    "asn": "0003"
  },
  "ipmap": {
    "country": "US",
    "city": "Santa Clara", // provider's "Santa Clara" city is in the DC cities list so that value is kept
    "lat": 37.3541,
    "long": -121.9552,
    "asn": "0004"
  },
  "fastly": {
    "country": "US",
    "city": "San Jose", // provider's "San Jose" city is in the DC cities list so that value is kept
    "lat": 36.837866,
    "long": -123.341544,
    "asn": "0005"
  },
}
```

### Step 3

Sort accoriding to the priority. All providers are prioritized so we are able to make a decision in draw situations. Current priority is: `["ipinfo", "ip2location", "maxmind", "ipmap", "fastly"]`, where `"ipinfo"` is the top prioritized.
Sorting rules are:
- providers with the same "country" are grouped and go first
- providers with the same "city" within the top "country" are grouped and go first
- if there are several groups of the same size, group with the most prioritized provider goes first
- groups are sorted internally by the priority of providers

New data state:
```js
{
  "ipinfo": { // group "San Jose", provider has the top priority
    "country": "US",
    "city": "San Jose",
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
  "fastly": { // group "San Jose", provider moved to the second place as its group goes first
    "country": "US",
    "city": "San Jose",
    "lat": 36.837866,
    "long": -123.341544,
    "asn": "0005"
  },
  "ip2location": { // group "Los Angeles"
    "country": "US",
    "city": "Los Angeles",
    "lat": 33.790287,
    "long": -118.193769,
    "asn": "0002"
  },
  "maxmind": { // group "Los Angeles"
    "country": "US",
    "city": "Los Angeles",
    "lat": 34.0544,
    "long": -118.2441,
    "asn": "0003"
  },
  "ipmap": { // group "Santa Clara", provider moved to the last place as there is only one provider in "Santa Clara" group
    "country": "US",
    "city": "Santa Clara",
    "lat": 37.3541,
    "long": -121.9552,
    "asn": "0004"
  },
}
```

### Step 4

Pick the first item from the result list. Data from "ipinfo" wins. It's values ("city", "asn", and other metadata) will be used to describe the probe.

Final result:
```js
{
  "ipinfo": {
    "country": "US",
    "city": "San Jose",
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
}
```
