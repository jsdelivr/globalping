# Location Schema

supported `type` values:
- [`continent`](#continent-query)
- [`region`](#region-query)
- [`country`](#country-query)
- [`state`](#state-query)
- [`city`](#city-query)
- [`network`](#network-query)
- [`asn`](#asn-query)

<h2 id="continent-query">Continent</h2>

### rules

- typeof `string`
- case insensitive
- must mutch one of the pre-defined values

### available values

`continent` type accepts any value that matches continent name in `ISO-2` format

### example

```json
{ "type": "continent", "value": "eu" }
```

<h2 id="region-query">Region</h2>

### rules

- typeof string
- case insensitive
- must mutch one of the pre-defined values

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
- must mutch one of the pre-defined values

### available values

`country` type accepts any value that matches country name in `ISO-2` format

### example

```json
{ "type": "country", "value": "finland" }
```

<h2 id="state-query">State</h2>

### rules

- typeof `string`
- case insensitive
- must mutch one of the pre-defined values
- only applicable to USA states

### available values

`state` type accepts any value that matches state name in `ISO-2` format

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

