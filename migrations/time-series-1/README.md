This folder contains Knex migrations for the `time-series-1` database.

Migrations are applied automatically during development during `docker compose up` but may be also run manually when needed:

```
npm run knex:time-series-1 migrate:latest
```

To create a new migration:

```
npm run knex:time-series-1 migrate:make <migration_name>
```
