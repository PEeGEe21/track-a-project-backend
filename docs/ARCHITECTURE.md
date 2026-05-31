# Backend Architecture

This backend is a NestJS monolith organized by domain modules.

## High-Level Shape

```text
Frontend App / Admin App
        |
        v
  NestJS HTTP API
        |
        +-- Auth / Users / Organizations
        +-- Projects / Tasks / Status
        +-- Resources / Documents / Folders
        +-- Messages / Notifications / Whiteboards
        +-- Billing / Admin
        |
        +-- MySQL via TypeORM
        +-- Supabase Storage
        +-- Redis (optional, for throttling and queues)
```

## Request Flow

```text
Client Request
  -> Nest bootstrap in src/main.ts
  -> security middleware / CORS / validation
  -> controller
  -> guard chain
  -> service layer
  -> TypeORM repositories / external integrations
  -> normalized response or global exception filter
```

## Major Module Boundaries

- `auth`
  Handles login, signup, org switching, impersonation, token flows.
- `users`
  Handles profile, onboarding, peer relationships, dashboard views.
- `organizations`
  Handles membership, invitations, menus, plan-related org operations.
- `projects`
  Handles projects, comments, invites, reactions, and project activity.
- `tasks`, `status`
  Handle task execution and task-state metadata.
- `resources`, `documents`, `folders`
  Handle uploaded assets and document organization.
- `messages`, `notifications`, `whiteboards`
  Handle real-time and collaboration features.
- `billing`
  Handles subscriptions, invoices, and plan state.
- `admin`
  Handles super-admin-only operations.

## Data And Infra Flow

```text
HTTP / WebSocket input
  -> Guards validate auth + tenant context
  -> Services enforce domain rules
  -> MySQL stores system-of-record data
  -> Supabase stores file blobs
  -> Redis optionally backs:
     - HTTP throttling
     - WebSocket event throttling
     - BullMQ jobs for mail and notifications
```

## Real-Time Flow

- Gateway connection accepted in the relevant module.
- Client registers identity or joins a room.
- Gateway validates payload shape and applies event throttling.
- Service persists domain changes when required.
- Gateway broadcasts room/user updates.

Primary gateway files:

- [src/messages/messages.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/messages/messages.gateway.ts)
- [src/notifications/notifications.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/notifications/notifications.gateway.ts)
- [src/projects/projects.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/projects/projects.gateway.ts)
- [src/whiteboards/whiteboards.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/whiteboards/whiteboards.gateway.ts)

## Async Work Flow

```text
Service requests async side effect
  -> inline path when QUEUE_DRIVER=inline
  -> BullMQ job when QUEUE_DRIVER=redis
  -> worker processes mail / notification delivery
```

Primary async files:

- [src/utils/mailing/mailing.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/utils/mailing/mailing.service.ts)
- [src/notifications/services/notifications.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/notifications/services/notifications.service.ts)
- [src/redis/redis.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/redis/redis.service.ts)

## Startup Entry Points

- [src/main.ts](/var/www/html/trackr-main/track-a-project-backend/src/main.ts)
- [src/app.module.ts](/var/www/html/trackr-main/track-a-project-backend/src/app.module.ts)
- [src/config/index.ts](/var/www/html/trackr-main/track-a-project-backend/src/config/index.ts)
