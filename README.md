# Track-A-Project Backend

NestJS API for the Trackr platform. This service powers authentication, organizations, projects, tasks, notifications, documents, whiteboards, billing, and admin operations for the frontend apps in this workspace.

## Stack

- NestJS 10
- TypeORM
- MySQL
- JWT auth
- Supabase storage for hosted environments
- MinIO/S3-compatible storage for local environments
- Redis-ready throttling and queues
- Socket.IO gateways

## Runtime

- Node.js `20.11.1`
- npm `10+`

Use either of these files to pin the runtime locally:

- [.nvmrc](/var/www/html/trackr-main/track-a-project-backend/.nvmrc)
- [.node-version](/var/www/html/trackr-main/track-a-project-backend/.node-version)

The package also declares `engines` in [package.json](/var/www/html/trackr-main/track-a-project-backend/package.json).

## App Shape

Main domains:

- `auth`: login, signup, impersonation, org switching
- `users`: profiles, peers, dashboard data
- `organizations`: org membership, invitations, menus, plans
- `projects`: projects, comments, peer invites, analytics
- `tasks`, `status`, `resources`, `documents`, `folders`
- `messages`, `notifications`, `whiteboards`
- `billing`, `admin`
- `health`: startup/readiness endpoint

Key entry points:

- [src/main.ts](/var/www/html/trackr-main/track-a-project-backend/src/main.ts)
- [src/app.module.ts](/var/www/html/trackr-main/track-a-project-backend/src/app.module.ts)
- [src/config/index.ts](/var/www/html/trackr-main/track-a-project-backend/src/config/index.ts)

Architecture and maintenance docs:

- [docs/ARCHITECTURE.md](/var/www/html/trackr-main/track-a-project-backend/docs/ARCHITECTURE.md)
- [docs/OWNERSHIP.md](/var/www/html/trackr-main/track-a-project-backend/docs/OWNERSHIP.md)
- [docs/CACHE-POLICY.md](/var/www/html/trackr-main/track-a-project-backend/docs/CACHE-POLICY.md)

## Environment

Start from [.env.example](/var/www/html/trackr-main/track-a-project-backend/.env.example).

Required core values:

- `NODE_ENV`
- `PORT`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_TOKEN_SECRET`
- `JWT_REFRESH_EXPIRES_IN`
- `FRONTEND_URL`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`
- `STORAGE_DRIVER`
- Supabase credentials when `STORAGE_DRIVER=supabase`
- S3/MinIO credentials when `STORAGE_DRIVER=minio`
- For local avatar/file display through direct MinIO URLs, set `S3_BUCKET_PUBLIC_READ=true`

Important optional values:

- `ADMIN_FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `APP_URL`
- `PEER_LINK_MAIN`
- `RUN_MIGRATIONS_ON_STARTUP`
- `REDIS_ENABLED`
- `REDIS_URL`
- `REDIS_PREFIX`
- `RATE_LIMIT_DRIVER`
- `QUEUE_DRIVER`

Secret ownership:

- Backend team owns JWT secrets, app URLs, and runtime flags.
- Frontend and backend teams jointly own browser-facing URLs and invite-link destinations.
- Infra or database owners own database credentials and rotation policy.
- Platform or operations owners own mail and Supabase credentials.
- Keep ownership notes current in [.env.example](/var/www/html/trackr-main/track-a-project-backend/.env.example) when adding new integrations.

## Local Setup

```bash
npm install
cp .env.example .env
```

Fill in your database, JWT, and storage credentials before starting the app.

## Commands

```bash
npm run start:dev
npm run build
npm run typecheck
npm run test
npm run test:smoke
npm run migration:run
```

## Rate Limiting

HTTP throttling is now enforced with `@nestjs/throttler`.

- Sensitive auth routes use tighter per-route limits.
- Invite and invitation-validation routes are throttled separately.
- The default storage driver is in-memory.
- Set `RATE_LIMIT_DRIVER=redis` with `REDIS_ENABLED=true` to move throttling to Redis for multi-instance deployments.

Realtime gateway events also use backend-side websocket throttling for registration, typing, whiteboard updates, project comments, and similar burst-heavy events.

## Redis And Queues

Redis support is now wired through [src/redis/redis.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/redis/redis.service.ts).

- `REDIS_ENABLED=false` keeps the backend self-contained for local development.
- `REDIS_ENABLED=true` plus `REDIS_URL` enables Redis health checks and Redis-backed throttling.
- `QUEUE_DRIVER=inline` keeps current behavior in-process.
- `QUEUE_DRIVER=redis` enables BullMQ-backed mail and notification delivery in Redis environments.

Installed packages:

- `@nestjs/throttler`
- `ioredis`
- `bullmq`

## Database Strategy

This backend is now migration-first.

- `synchronize` is disabled in [src/app.module.ts](/var/www/html/trackr-main/track-a-project-backend/src/app.module.ts)
- Schema changes should go through TypeORM migrations
- Optional startup migration execution is controlled by `RUN_MIGRATIONS_ON_STARTUP=false|true`

Recommended flow:

1. Create or generate a migration
2. Review the SQL shape carefully
3. Run `npm run migration:run`
4. Start the app

Avoid relying on runtime schema sync in shared or production environments.

## Logging Strategy

Structured application logging now lives in [src/common/logging/app-logger.ts](/var/www/html/trackr-main/track-a-project-backend/src/common/logging/app-logger.ts).

Guidelines:

- Use `AppLogger.log()` for startup and lifecycle events
- Use `AppLogger.warn()` for recoverable operational concerns
- Use `AppLogger.error()` for failures
- Do not log passwords, tokens, full request bodies, uploaded file objects, or raw user records

## Health And Verification

Endpoints:

- `GET /api/health`
- `GET /api/docs`
- `GET /`

Expected quick checks after startup:

1. `GET /api/health` returns `status: "ok"`
2. `GET /api/docs` loads Swagger
3. Auth-protected routes reject missing/invalid tokens
4. CORS only allows configured origins
5. `infrastructure.redis` in the health payload reflects whether Redis is configured and reachable

## Audit Checklist

Use [BACKEND-AUDIT-CHECKLIST.md](/var/www/html/trackr-main/track-a-project-backend/BACKEND-AUDIT-CHECKLIST.md) for targeted reviews of uploads, storage, tenant safety, and socket gateways before release.

## Smoke Tests

Current smoke coverage targets:

- auth controller delegation
- users controller delegation
- organizations controller invitation flow
- super-admin guard behavior
- health controller response

Run them with:

```bash
npm run test:smoke
```
