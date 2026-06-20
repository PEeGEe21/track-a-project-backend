# ProjectTrakr Ingestion SDK Integration Plan

## Goal

Integrate the draft ingestion API and SDK into this repo in a way that fits the current backend architecture:

- NestJS + TypeORM + MySQL, not Prisma
- organization-aware projects and tasks
- project-specific statuses
- existing throttling, storage, and activity systems

This plan is intentionally file-by-file and implementation-oriented.

## Key Decisions

### 1. Keep external auth project-scoped, resolve org internally

The spec says one API key maps to one project. In this repo, tasks also belong to an organization and most project operations are org-aware.

Implementation rule:

- external caller sends only `Authorization: Bearer <trk_* key>`
- backend resolves:
  - `IngestApiKey -> project`
  - `project -> organization`
- ingestion-created tasks are written with both `project` and `organization_id`

Relevant current files:

- [src/projects/controllers/projects.controller.ts](/var/www/html/trackr-main/track-a-project-backend/src/projects/controllers/projects.controller.ts:25)
- [src/tasks/services/tasks.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/tasks/services/tasks.service.ts:1019)
- [src/typeorm/entities/Project.ts](/var/www/html/trackr-main/track-a-project-backend/src/typeorm/entities/Project.ts:76)
- [src/typeorm/entities/Task.ts](/var/www/html/trackr-main/track-a-project-backend/src/typeorm/entities/Task.ts:52)

### 2. Define “closed” using statuses, not a task boolean

The draft dedupe behavior depends on “open” vs “closed,” but tasks here use project-specific statuses.

Implementation rule:

- add terminal-state metadata to statuses
- dedupe checks terminal vs non-terminal status

Recommended first step:

- add `isTerminal: boolean` to `Status`

Relevant current file:

- [src/typeorm/entities/Status.ts](/var/www/html/trackr-main/track-a-project-backend/src/typeorm/entities/Status.ts:1)

### 3. Start with “reopen on closed-task dedupe”

Adopt the draft recommendation:

- if `dedupeKey` matches a task in a non-terminal status:
  - increment occurrence count
  - update `lastSeenAt`
  - return `200 deduped`
- if `dedupeKey` matches a task in a terminal status:
  - move task back to the project’s default ingestion status
  - increment occurrence count
  - update `lastSeenAt`
  - return `200 deduped`

### 4. Do not require `projectId` in SDK init

Because the API key already maps to a single project, SDK config should not need `projectId` for ingestion calls.

Recommended SDK shape:

```ts
trakr.init({ apiKey, url })
trakr.capture(...)
trakr.captureError(...)
trakr.errorHandler()
```

### 5. Keep `trk_test_*` keys non-writing but observable

For test keys:

- validate request body
- update `lastUsedAt`
- apply rate limiting
- return synthetic response
- do not create tasks
- do not create ingested-event rows

## Target Backend Shape

### New module

Add a dedicated `ingestion` module:

- controller for `POST /api/v1/ingest/tasks`
- auth guard for project API keys
- service for dedupe + task creation/reopen
- DTOs for validation

### New entities

Add two TypeORM entities:

#### `IngestApiKey`

- `id`
- `project_id`
- `organization_id`
- `key_hash`
- `key_prefix`
- `label`
- `revoked_at`
- `created_at`
- `last_used_at`

#### `IngestedEvent`

- `id`
- `task_id`
- `project_id`
- `organization_id`
- `source`
- `severity`
- `dedupe_key`
- `metadata` as MySQL `json`
- `occurrence_count`
- `last_seen_at`
- `created_at`
- `updated_at`

### Project settings needed

Each project needs a configured target status for ingestion-created or reopened tasks.

Recommended project field:

- `default_ingestion_status_id`

Alternative:

- derive from `Status.isDefault = true`

But explicit ingestion status is safer than reusing generic default status behavior.

## File-By-File Plan

### Phase 1: Schema and entity groundwork

#### 1. [src/typeorm/entities/Status.ts](/var/www/html/trackr-main/track-a-project-backend/src/typeorm/entities/Status.ts:1)

Add:

- `isTerminal: boolean`

Purpose:

- define whether a status counts as closed for ingestion dedupe

Notes:

- default `false`
- backfill existing “Done/Completed” style statuses later via migration or admin script

#### 2. [src/typeorm/entities/Project.ts](/var/www/html/trackr-main/track-a-project-backend/src/typeorm/entities/Project.ts:1)

Add:

- `default_ingestion_status_id: number | null`

Purpose:

- tell ingestion where to place new or reopened tasks

Notes:

- store as nullable initially
- validation should fail both ingestion and ingestion API-key creation for projects without this configured

#### 3. Add [src/typeorm/entities/IngestApiKey.ts](/var/www/html/trackr-main/track-a-project-backend/src/typeorm/entities/IngestApiKey.ts)

Create a new entity for project-scoped ingestion credentials.

Fields:

- numeric primary key or uuid
- project relation
- organization relation
- `key_hash`
- `key_prefix`
- `label`
- `revoked_at`
- `last_used_at`
- timestamps

Purpose:

- secure API-key lookup without storing plaintext

#### 4. Add [src/typeorm/entities/IngestedEvent.ts](/var/www/html/trackr-main/track-a-project-backend/src/typeorm/entities/IngestedEvent.ts)

Create a new entity for dedupe and event history.

Fields:

- task relation
- project relation
- organization relation
- source
- severity
- dedupe key
- metadata json
- occurrence count
- last seen at
- timestamps

Purpose:

- make dedupe explicit and auditable

#### 5. [src/app.module.ts](/var/www/html/trackr-main/track-a-project-backend/src/app.module.ts:1)

Update:

- TypeORM entity registration
- imports list to include `IngestionModule`

Add entities:

- `IngestApiKey`
- `IngestedEvent`

#### 6. Add a migration in [src/migrations](/var/www/html/trackr-main/track-a-project-backend/src/migrations)

Create one migration that:

- adds `status.isTerminal`
- adds `projects.default_ingestion_status_id`
- creates `ingest_api_keys`
- creates `ingested_events`
- adds indexes:
  - `(project_id, dedupe_key)`
  - `key_hash` unique
  - `revoked_at`

## Phase 2: New ingestion module

#### 7. Add [src/ingestion/ingestion.module.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/ingestion.module.ts)

Imports:

- `TypeOrmModule.forFeature([Project, Task, Status, Organization, IngestApiKey, IngestedEvent, ProjectActivity])`
- `StorageModule` only if needed later
- `ProjectActivitiesModule`
- `ConfigModule`

Purpose:

- isolate machine-ingestion behavior from user-authenticated task flows

#### 8. Add [src/ingestion/controllers/ingestion.controller.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/controllers/ingestion.controller.ts)

Add route:

```ts
POST / api / v1 / ingest / tasks;
```

Responsibilities:

- apply ingestion auth guard
- validate DTO
- call service
- shape `created` vs `deduped` responses

#### 9. Add [src/ingestion/dto/create-ingested-task.dto.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/dto/create-ingested-task.dto.ts)

Validate:

- `source` enum
- `title` required
- `description` optional
- `severity` enum with default `medium`
- `dedupeKey` optional
- `metadata` valid object/json
- `occurredAt` optional ISO date

Add payload limit handling:

- reject request bodies over 50KB at controller or app middleware layer

#### 10. Add [src/ingestion/services/ingestion.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/services/ingestion.service.ts)

Responsibilities:

- resolve current project/org from authenticated ingestion key
- determine target project status
- dedupe by `(project_id, dedupe_key)`
- create or reopen task
- create/update `IngestedEvent`
- write project activity
- return normalized response

Core methods:

- `ingestTaskEvent()`
- `findExistingByDedupeKey()`
- `createTaskFromEvent()`
- `reopenTaskFromEvent()`
- `incrementOccurrence()`

### Phase 3: Auth and key lifecycle

#### 11. Add [src/ingestion/guards/ingestion-api-key.guard.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/guards/ingestion-api-key.guard.ts)

Responsibilities:

- parse `Authorization: Bearer`
- validate `trk_live_*` / `trk_test_*`
- hash incoming key
- find active key row
- attach resolved ingestion context to request

Request context should include:

- `ingestKeyId`
- `isTestKey`
- `projectId`
- `organizationId`

#### 12. Add [src/ingestion/services/ingestion-key.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/services/ingestion-key.service.ts)

Responsibilities:

- generate raw keys
- hash keys before save
- persist prefix separately
- revoke keys
- update `last_used_at`

Recommended key format:

- `trk_live_<random>`
- `trk_test_<random>`

#### 13. Add [src/common/utils/crypto](/var/www/html/trackr-main/track-a-project-backend/src/common)

If there is no suitable existing helper, add a small utility for:

- secure random key generation
- stable hashing for lookup

This should not reuse password hashing. A fast keyed hash or SHA-256-based lookup hash is more appropriate than bcrypt for per-request key lookup.

## Phase 4: Reuse existing task behavior safely

#### 14. [src/tasks/services/tasks.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/tasks/services/tasks.service.ts:1019)

Refactor task creation logic into a reusable internal helper instead of duplicating task-write behavior in the ingestion module.

Candidate extraction:

- project resolution
- status resolution
- rich-description normalization
- task creation
- activity creation

Possible shape:

- existing public method remains user-facing
- new internal method accepts resolved entities and normalized payload

Goal:

- machine-ingested tasks and UI-created tasks should not diverge over time

#### 15. [src/project-activities/services/project-activities.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/project-activities/services/project-activities.service.ts)

Confirm whether a new activity type is needed.

Recommended additions:

- `TASK_INGESTED`
- possibly `TASK_REOPENED_BY_INGESTION`

Also update the activity constants file if needed.

## Phase 5: Project settings and admin surfaces

#### 16. [src/projects/controllers/projects.controller.ts](/var/www/html/trackr-main/track-a-project-backend/src/projects/controllers/projects.controller.ts:25)

Add authenticated project-settings endpoints for ingestion configuration:

- create live key
- create test key
- revoke key
- list keys
- update default ingestion status

These should stay behind the normal org/user guards, unlike the ingestion endpoint itself.

#### 17. [src/projects/services/projects.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/projects/services/projects.service.ts:71)

Add service methods to support project settings:

- `listIngestKeysForProject`
- `createIngestKeyForProject`
- `revokeIngestKeyForProject`
- `updateDefaultIngestionStatus`

Validate:

- caller belongs to org
- caller can manage the project
- selected ingestion status belongs to the same project

`createIngestKeyForProject` specifically must also validate:

- project.default_ingestion_status_id is not null — reject with a clear error (e.g. "Set a default ingestion status before generating an API key") if unset. Key creation is blocked, not just ingestion. See Reviewed addendum above.

## Phase 6: Rate limiting

#### 18. [src/common/rate-limit](/var/www/html/trackr-main/track-a-project-backend/src/common/rate-limit)

Use the existing throttling stack instead of a one-off limiter.

Implementation options:

- extend throttling guard behavior for ingestion route, or
- add service-level Redis-backed limiter dedicated to ingestion keys

Recommended rule:

- 100 requests/minute per ingestion key

Recommended Redis key pattern:

- `throttle:ingest:key:<ingestKeyId>`

#### 19. [docs/CACHE-POLICY.md](/var/www/html/trackr-main/track-a-project-backend/docs/CACHE-POLICY.md:1)

Update docs with:

- ingestion throttle key pattern
- TTL
- fallback behavior if Redis is unavailable

This keeps the repo’s Redis policy consistent.

## Phase 7: SDK package

This repo does not currently contain the SDK package, so this should likely live as a sibling package or separate repo.

If kept in this workspace, recommended location:

- `/projecttrakr-sdk`

Suggested files:

#### 20. Add `/projecttrakr-sdk/src/index.ts`

Public API:

- `init`
- `capture`
- `captureError`
- `errorHandler`

#### 21. Add `/projecttrakr-sdk/src/client.ts`

Responsibilities:

- HTTP client
- bearer auth header
- retry policy
- timeout handling

#### 22. Add `/projecttrakr-sdk/src/dedupe.ts`

Responsibilities:

- generate default dedupe key for error path
- recommended basis:
  - error message
  - top stack frame

#### 23. Add `/projecttrakr-sdk/src/types.ts`

Export:

- request types
- response types
- init config type

#### 24. Add `/projecttrakr-sdk/README.md`

Document:

- install
- live key vs test key
- global crash behavior
- Express/Fastify middleware example
- direct `capture()` example

## API Behavior to Lock Before Coding

### Request

```json
{
  "source": "error | ci | manual | webhook",
  "title": "required",
  "description": "optional",
  "severity": "low | medium | high | critical",
  "priority": "optional numeric task priority",
  "dedupeKey": "optional",
  "metadata": {},
  "occurredAt": "optional ISO string"
}
```

`severity` should remain distinct from task `priority`. Ingestion must store severity directly on the task and should not translate severity levels into priority values.

### Responses

#### Live key, new task

`201`

```json
{ "status": "created", "taskId": 123, "occurrenceCount": 1 }
```

#### Live key, deduped existing task

`200`

```json
{ "status": "deduped", "taskId": 123, "occurrenceCount": 14 }
```

#### Test key

`200`

```json
{ "status": "validated", "test": true }
```

## Validation and Security Checklist

### 25. [src/ingestion/dto/create-ingested-task.dto.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/dto/create-ingested-task.dto.ts)

Enforce:

- strict source enum
- strict severity enum
- max title length
- max description length
- metadata must be object-like JSON

### 26. [src/ingestion/guards/ingestion-api-key.guard.ts](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/guards/ingestion-api-key.guard.ts)

Enforce:

- revoked keys fail `401`
- malformed prefixes fail `401`
- missing auth header fails `401`

### 27. [README.md](/var/www/html/trackr-main/track-a-project-backend/README.md:53)

Update environment docs for:

- ingestion key generation strategy
- whether SDK URL differs from main API URL
- any new rate-limit or ingestion-related env vars

Recommended new env vars if needed:

- `INGESTION_RATE_LIMIT_PER_MINUTE`
- `INGESTION_MAX_BODY_KB`

## Testing Plan

### 28. Add controller tests under [src/ingestion/controllers](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/controllers)

Test:

- valid live key creates task
- valid test key validates without writing
- revoked key rejected
- invalid body rejected
- oversized body rejected

### 29. Add service tests under [src/ingestion/services](/var/www/html/trackr-main/track-a-project-backend/src/ingestion/services)

Test:

- new event creates task + ingested row
- duplicate event increments occurrence count
- terminal-status task reopens on duplicate
- missing default ingestion status fails clearly

Also add project-settings service/controller coverage for:

- `createIngestKeyForProject` rejects when `project.default_ingestion_status_id` is unset
- error message is clear and action-oriented, e.g. "Set a default ingestion status before generating an API key"

### 30. Add smoke coverage if this becomes a release-critical integration

Candidate:

- one end-to-end ingestion test with seeded project, status, and key

## Suggested Delivery Order

### Slice 1

- entities
- migration
- `Status.isTerminal`
- `Project.default_ingestion_status_id`

### Slice 2

- ingestion module
- key auth guard
- DTO validation
- live/test key behavior

### Slice 3

- dedupe + reopen logic
- activity logging
- tests

### Slice 4

- project settings endpoints for key management
- docs

### Slice 5

- SDK package

## Recommended Non-Goals For First Release

- no provider-specific webhook adapters yet
- no UI dashboard for ingested-event analytics yet
- no attempt to merge this with the natural-language task agent yet
- no per-project configurable dedupe strategy yet beyond reopen behavior

## Summary

The cleanest implementation in this repo is:

- a new `ingestion` backend module
- two new TypeORM entities
- a small project-settings extension
- one new status concept: `isTerminal`
- one project config: `default_ingestion_status_id`
- reuse of current task-write behavior rather than a parallel task system

That keeps the ingestion API compatible with the current architecture instead of forcing Prisma/Postgres assumptions into a NestJS/TypeORM/MySQL codebase.
