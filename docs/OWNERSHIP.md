# Backend Ownership Notes

This file is a maintenance guide, not a strict org chart. Update it when module ownership changes.

## Ownership Model

- Product/backend team
  Owns domain behavior, controller/service rules, DTOs, and API compatibility.
- Platform/infra team
  Owns Redis, queue runtime, deployment shape, secrets rotation, and database operations support.
- Frontend teams
  Co-own API contracts, auth flow expectations, and organization-scoped request behavior.

## Module Notes

- `auth`
  Critical surface. Changes should be reviewed with security impact in mind.
- `users`
  High change frequency. Watch for permission drift and notification side effects.
- `organizations`
  Shared ownership with product/backend because org membership affects every app.
- `projects`
  High-complexity area. Prefer small changes with tests because it touches comments, invites, reactions, and activities.
- `messages`, `notifications`, `whiteboards`
  Shared backend/platform concern because they mix app logic with realtime delivery behavior.
- `resources`, `documents`, `storage`
  Shared backend/platform concern because access rules and storage settings both matter.
- `billing`
  Treat as restricted-change area. Review carefully for plan and entitlement impact.
- `admin`
  Treat as restricted-change area. Review carefully for super-admin and impersonation impact.

## Review Expectations

- Auth, admin, impersonation, roles, and tenant access changes should get a second reviewer.
- Storage, uploads, Redis, queue, and rate-limit changes should include a platform-aware review.
- Organization and project invitation changes should be reviewed for email, notification, and tenant-scope impact.

## Operational Owners

- Runtime config: backend team
- Database schema and migration safety: backend team with infra support
- Redis and BullMQ runtime: platform/infra
- Mail transport credentials and deliverability: platform/operations
- Supabase storage configuration: platform/operations

## Change Checklist

- Confirm which module owns the business rule you are changing.
- Confirm whether the change affects another app in this workspace.
- Confirm whether throttling, queues, notifications, or storage side effects are involved.
- Add or update tests when changing shared or critical modules.
