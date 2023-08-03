# Geo IP algorithm

Input:
- ip adress of a probe

Output:
- location information about the ip

### Step 1

For that example there are 6 geo ip info providers. We get data from each of them.

Data state:
```js
{
  "providerA": {
    "country": "US",
    "city": "Cupertino",
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
  "providerB": {
    "country": "US",
    "city": "Long Beach",
    "lat": 33.790287, 
    "long": -118.193769,
    "asn": "0002"
  },
  "providerC": {
    "country": "US",
    "city": "Los Angeles",
    "lat": 34.0544,
    "long": -118.2441,
    "asn": "0003"
  },
  "providerD": {
    "error": "Not found"
  },
  "providerE": {
    "country": "US",
    "city": "Santa Clara",
    "lat": 37.3541,
    "long": -121.9552,
    "asn": "0005"
  },
  "providerF": {
    "country": "US",
    "city": "San Jose",
    "lat": 36.837866,
    "long": -123.341544,
    "asn": "0006"
  }
}
```

### Step 2

Filter out error results.

Data state:
```js
{
  "providerA": {
    "country": "US",
    "city": "Cupertino",
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
  "providerB": {
    "country": "US",
    "city": "Long Beach",
    "lat": 33.790287, 
    "long": -118.193769,
    "asn": "0002"
  },
  "providerC": {
    "country": "US",
    "city": "Los Angeles",
    "lat": 34.0544,
    "long": -118.2441,
    "asn": "0003"
  },
  // providerD was removed because of error
  "providerE": {
    "country": "US",
    "city": "Santa Clara",
    "lat": 37.3541,
    "long": -121.9552,
    "asn": "0005"
  },
  "providerF": {
    "country": "US",
    "city": "San Jose",
    "lat": 36.837866,
    "long": -123.341544,
    "asn": "0006"
  }
}
```

### Step 3

Get approximated city. Every provider has lat/long and country info, so for every provider we are:
- searching in geonames db in radius of 30 km using providers's lat/long;
- filtering the result cities to be in same country as the provider's one;
- if there are multiple cities we are searching for the one with the biggest population;
- result is an approximated city, it is written to the provider's "city" field;
- if no approximated city was found provider is removed.

Data state:
```js
{
  "providerA": {
    "country": "US",
    "city": "San Jose", // approximated city is "San Jose", so it is set instead of "Cupertino"
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
  "providerB": {
    "country": "US",
    "city": "Los Angeles", // approximated city is "Los Angeles", so it is set instead of "Long Beach"
    "lat": 33.790287, 
    "long": -118.193769,
    "asn": "0002"
  },
  "providerC": {
    "country": "US",
    "city": "Los Angeles", // approximated city is "Los Angeles", so no changes here
    "lat": 34.0544,
    "long": -118.2441,
    "asn": "0003"
  },
  "providerE": {
    "country": "US",
    "city": "San Jose", // approximated city is "San Jose", so it is set instead of "Santa Clara"
    "lat": 37.3541,
    "long": -121.9552,
    "asn": "0005"
  },
  // providerF was removed because no city was found for it's lat: 36.837866, long: -123.341544
}
```

### Step 4

Sort accoriding to the priority. All providers are prioritized so we are able to prefer one in draw situations. Priority for the example is: `[providerA, providerB, providerC, providerD, providerE, providerF]`, where "providerA" is the top prioritized.
Sorting rules are:
- providers with the same "city" are grouped and go first
- if there are several groups of the same size, group with the most prioritized provider goes first
- groups are sorted internally by the priority of providers

Data state:
```js
{
  "providerA": { // group "San Jose", provider has the top priority
    "country": "US",
    "city": "San Jose",
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
  "providerE": { // group "San Jose", provider moved to the second place as its group goes first
    "country": "US",
    "city": "San Jose", 
    "lat": 37.3541,
    "long": -121.9552,
    "asn": "0005"
  },
  "providerB": { // group "Los Angeles"
    "country": "US",
    "city": "Los Angeles", 
    "lat": 33.790287, 
    "long": -118.193769,
    "asn": "0002"
  },
  "providerC": { // group "Los Angeles"
    "country": "US",
    "city": "Los Angeles",
    "lat": 34.0544,
    "long": -118.2441,
    "asn": "0003"
  },
}
```

### Step 5

Pick the first item from the result list. Data from "providerA" wins. It's values ("city", "asn", and other metadata) will be used to describe the probe.

```js
{
  "providerA": {
    "country": "US",
    "city": "San Jose",
    "lat": 37.323,
    "long": -122.03218,
    "asn": "0001"
  },
}
```
