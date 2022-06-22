# Location Schema

supported `type` values:
- [`continent`](#continent-query)
- [`region`](#region-query)
- [`country`](#country-query)
- [`state`](#state-query)
- [`city`](#city-query)
- [`network`](#network-query)
- [`asn`](#asn-query)
- [`magic`](#magic-query)

<h2 id="continent-query">Continent</h2>

### rules

- typeof `string`
- case insensitive
- must match one of the pre-defined values

### available values

`continent` type accepts any value matching continent name in `ISO-2` format.

### example

```json
{ "type": "continent", "value": "eu" }
```

<h2 id="region-query">Region</h2>

### rules

- typeof string
- case insensitive
- must match one of the pre-defined values

### available values

- `northern europe`
- `southern europe`
- `western europe`
- `eastern europe`
- `southern asia`
- `south eastern asia`
- `western asia`
- `eastern asia`
- `central asia`
- `western africa`
- `eastern africa`
- `southern africa`
- `northern africa`
- `middle africa`
- `central america`
- `northern america`
- `southern america`
- `australasia`
- `caribbean`
- `polynesia`
- `melanesia`
- `micronesia`

### example

```json
{ "type": "region", "value": "eastern africa" }
```

<h2 id="country-query">Country</h2>

### rules

- typeof `string`
- case insensitive
- must match one of the pre-defined values

### available values

`country` type accepts any value matching country name in `ISO-2` format.

### example

```json
{ "type": "country", "value": "fr" }
```

<h2 id="state-query">State</h2>

### rules

- typeof `string`
- case insensitive
- must match one of the pre-defined values
- only applicable to USA states

### available values

`state` type accepts any value matching state name in `ISO-2` format.

### example

```json
{ "type": "state", "value": "tx" }
```

<h2 id="city-query">City</h2>

### rules

- typeof `string`
- case insensitive
- at least 1 character long
- max 128 characters long

### example

```json
{ "type": "city", "value": "Austin" }
```

<h2 id="network-query">Network</h2>

### rules

- typeof `string`
- case insensitive
- at least 1 character long
- max 128 characters long

### example

```json
{ "type": "network", "value": "virgin media limited" }
```

<h2 id="asn-query">ASN</h2>

### rules

- typeof `number`

### example

```json
{ "type": "asn", "value": 1337 }
```

<h2 id="magic-query">magic</h2>

unlike other location queries, `magic` query doesn't attempt to match a specific value, but rather a pool of available matches, contained within a pre-defined array. It works by finding a partial string match of any of the above described variables. It also supports country matching based on [`Iso2`/`Iso3`](https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes), common `aliases` and their full, official names format. Aliases also apply to `networks`, as well as combined matches.

A full list of aliases can be found here:
- [`countries`](https://github.com/jsdelivr/globalping/blob/master/src/lib/location/countries.ts)
- [`networks`](https://github.com/jsdelivr/globalping/blob/master/src/lib/location/networks.ts)

### rules

- typeof `string`
- inputs are always converted to lowercase
- `ASN` starts with `as` prefix (`as123`)
- `latitude`/`longitude` fields are excluded
- combined matches have to be joined with `+` sign

### examples

the following queries will match `DE`

```json
{ "type": "magic", "value": "ger" },
{ "type": "magic", "value": "deu" }
```

both of the following queries would match `amazon technologies inc.` network

```json
{ "type": "magic", "value": "aws" },
{ "type": "magic", "value": "amazon" }
```

magic queries can be combined. The following query will match server in `Belgium` hosted at `Google Cloud` DC.

```json
{ "type": "magic", "value": "google+belgium" }
```
