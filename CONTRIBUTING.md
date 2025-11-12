# Contributing guide

Hi! We're really excited that you're interested in contributing! Before submitting your contribution, please read through the following guide.

## General guidelines

-   Bug fixes and changes discussed in the existing issues are always welcome.
-   For new ideas, please open an issue to discuss them before sending a PR.
-   Make sure your PR passes `npm test` and has [appropriate commit messages](https://github.com/jsdelivr/globalping/commits/master).

## Project setup

To run the Globalping API locally, you will need:

- Node.js v22/v24
- Redis with the [RedisJSON](https://oss.redis.com/redisjson/) module
- MariaDB (for the dashboard DB)
- TimescaleDB (PostgreSQL) for the measurement store

All the databases are included in `docker-compose.dev.yml`. You will also need to run a development instance of the [Globalping Probe](https://github.com/jsdelivr/globalping-probe) at the same time when testing.

The API uses port 3000 by default. This can be overridden by `PORT` environment variable.

You can run the project by following these steps:

1. Clone this repository.
2. [Enable host networking in Docker Desktop](https://docs.docker.com/engine/network/drivers/host/#docker-desktop) if you haven't already.
3. `npm install && npm run download:files`
4. `docker compose -f docker-compose.dev.yml up -d` – Start Redis, MariaDB, and TimescaleDB.
5. Run `npm run start:dev`

Once the API is live, you can spin up a probe instance by running as described at https://github.com/jsdelivr/globalping-probe/blob/master/CONTRIBUTING.md.

### Environment variables
- `PORT=3000` environment variable can start the API on another port (default is 3000)
- `FAKE_PROBE_IP=1` environment variable can be used to make debug easier. When defined, every Probe
  that connects to the API will get an IP address from the list of predefined "real" addresses.

### Testing

A single command to run everything: `npm test`

To run a specific linter or a test suite, please see the scripts section of [package.json](package.json).

Most IDEs have plugins integrating the used linter (eslint), including support for automated fixes on save.

## Production config

### Environment variables

- `ELASTIC_APM_SERVER_URL={value}` used in production to send APM metrics to elastic
- `ELASTIC_APM_SECRET_TOKEN={value}` used in production to send APM metrics to elastic
- `ELASTIC_SEARCH_URL={value}` used in production to send logs to elastic
- `FAKE_PROBE_IP=1` used in development to use a random fake ip assigned by the API
- `ADMIN_KEY={value}` used to access additional information over the API
- `SYSTEM_API_KEY={value}` used for integration with the dashboard
- `SERVER_SESSION_COOKIE_SECRET={value}` used to read the shared session cookie
- `DASHBOARD_DB_CONNECTION_HOST`, `DASHBOARD_DB_CONNECTION_USER`, `DASHBOARD_DB_CONNECTION_PASSWORD`, and `DASHBOARD_DB_CONNECTION_DATABASE` dashboard database connection details
- `MEASUREMENT_STORE_DB_CONNECTION_HOST`, `MEASUREMENT_STORE_DB_CONNECTION_USER`, `MEASUREMENT_STORE_DB_CONNECTION_PASSWORD`, and `MEASUREMENT_STORE_DB_CONNECTION_DATABASE` measurement store database connection details
- `REDIS_STANDALONE_PERSISTENT_URL`, `REDIS_STANDALONE_PERSISTENT_NO_EVICTION_URL`, `REDIS_STANDALONE_NON_PERSISTENT_URL`, `REDIS_CLUSTER_MEASUREMENTS_NODES_0`, `REDIS_CLUSTER_MEASUREMENTS_NODES_1`, `REDIS_CLUSTER_MEASUREMENTS_NODES_2`, and `REDIS_SHARED_OPTIONS_PASSWORD` - redis connection details
- `SERVER_TRUSTED_PROXIES=["...","..."]`
