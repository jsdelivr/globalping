# AGENTS.md

## Project

- Node.js ESM TypeScript backend service for the Globalping API. Supports Node.js 22, 24, and 26.
- Production uses `docker-compose.yml` for databases and `compose-stack.yml` for the API; local development runs Redis, MariaDB, and TimescaleDB with `docker-compose.dev.yml` while the Node.js app runs directly on the host.
- Development measurement flows also require a running [Globalping Probe](https://github.com/jsdelivr/globalping-probe).

## Commands

- Install: `npm ci`
- Download required runtime data: `npm run download:files`
- Start required development and test services: `docker compose -f docker-compose.dev.yml up -d`

## Worktree Setup

- Create worktrees under `.worktrees/` (already git-ignored).
- Create `config/local.env` and `config/local.cjs` files with unique ports immediately when creating a worktree (already git-ignored).
- `config/local.env` is for Docker Compose. Set `COMPOSE_PROJECT_NAME` by adding the branch as a suffix (for example, `globalping-gh-123`) and assign unique values to every service and Redis Cluster bus port variable in `docker-compose.dev.yml`.
- `config/local.cjs` is for Node config. Set a unique `server.port`, matching ports in all three Redis URLs and the first three Redis cluster nodes, and matching `dashboardDb.connection.port`, `measurementStoreDb.connection.port`, and `timeSeriesDb.connection.port` values.
- Run `npm ci` and start services with `docker compose --env-file config/local.env -f docker-compose.dev.yml up -d`. Bring them down with the matching `docker compose --env-file config/local.env -f docker-compose.dev.yml down` command when finished.

## Code Style

- Use tabs for code indentation and spaces for Markdown.
- Keep the project ESM-only. Use explicit `.js` extensions in relative TypeScript imports.
- Use the existing scoped logger instead of `console.*`.
- Use camelCase database column names and avoid redundant schema fields.
- Keep interfaces direct. Avoid getters, factories, optional dependency parameters, or test-only methods unless production code needs them.
- Keep async behavior intentional. Await work when callers need the result; use `.catch()` for intentional fire-and-forget work.

## Testing

- Ensure Worktree Setup was done properly if using worktrees, and that the development Docker services are running for integration and contract tests.
- For all test-related commands, set the following environment variables:
  - `MOCHA_OPTIONS="--reporter=min"` unless you specifically need details about passing tests,
  - `LOG_LEVEL=60` unless you specifically need app log output at lower levels.
- Add or update tests when changing already-tested behavior.
- For existing untested code, keep fixes targeted and do not add tests unless asked.
- For normal verification, run sequentially: `npm run lint`, `npm run test:mocha`, `npm run test:portman`.
- Run `npm run test:dist` when changes affect the build, package contents, or startup path.
- Run `npm run test:e2e` when changes affect probe/API integration or when explicitly requested.

### Adding tests

- Prefer behavior-focused tests over tests that assert implementation details.
- Integration tests should exercise application behavior across real dependencies.
- Unit tests should cover logic that integration tests cannot reasonably cover.
- Shared test mocks are fine for background noise. Tests that assert specific behavior should own and restore their own mocks.
