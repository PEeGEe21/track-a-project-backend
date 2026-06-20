# Redis Cache Policy

This backend now uses Redis for throttling and queue support when enabled. Treat cache introduction as deliberate design work, not an ad hoc shortcut.

## Current Redis Uses

- HTTP throttling storage when `RATE_LIMIT_DRIVER=redis`
- ingestion-key throttling via `trackr:throttle:ingest:key:<ingestKeyId>` when ingestion is enabled
- WebSocket event throttling support
- BullMQ queue transport for mail and notifications when `QUEUE_DRIVER=redis`

Ingestion throttling details:

- key pattern: `<REDIS_PREFIX>:throttle:ingest:key:<ingestKeyId>`
- owning module: `ingestion`
- TTL: `RATE_LIMIT_INGESTION_WINDOW_MS` default `60000`
- fallback behavior: falls back to in-memory throttling through the shared throttler storage when Redis is unavailable

## Current Non-Uses

- No general-purpose entity caching is enabled yet.
- No read-through caching is enabled for users, projects, organizations, or dashboards.
- No cache invalidation framework exists yet for cross-module domain data.

## Policy

- Do not cache system-of-record writes.
- Do not cache tenant-sensitive reads without explicit invalidation rules.
- Do not add one-off Redis keys from services without documenting key shape, TTL, and invalidation behavior here.
- Prefer caching derived or expensive read models, not mutable source entities.

## Required Design Fields For New Cache Entries

Document these before merging a new Redis-backed cache:

- key pattern
- owning module
- TTL
- invalidation trigger
- fallback behavior if Redis is down
- whether stale reads are acceptable

## Suggested Boundaries

Good future candidates:

- dashboard aggregations
- organization menu/materialized access views
- expensive project listing filters
- short-lived presence or collaboration metadata

Poor candidates without more design work:

- auth tokens as app-managed cache state
- mutable organization membership snapshots
- billing entitlement source data
- invitation acceptance state without strict invalidation

## Key Prefixing

- Use the configured Redis prefix from `REDIS_PREFIX`.
- Keep keys namespaced by concern, such as `throttle`, `queue`, `presence`, or a documented domain namespace.
- Include organization or user scope when the data is tenant-specific.

## Failure Behavior

- Throttling may fall back to memory when Redis is unavailable.
- Queue-backed delivery may fall back to inline behavior depending on runtime configuration.
- New cache features must define whether they fail open, fail closed, or bypass cache on Redis outage.
