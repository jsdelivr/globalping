This folder contains Knex migrations for the `measurement-store-1` database.

Migrations are applied automatically during development during `docker compose up` but may be also run manually when needed:

```
npm run knex:measurement-store-1 migrate:latest
```

To create a new migration:

```
npm run knex:measurement-store-1 migrate:make <migration_name>
```
