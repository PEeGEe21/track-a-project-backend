# Track-A-Project Backend Implementation Plan

Status legend:
- `Not started`
- `In progress`
- `Done`
- `Blocked`

## Scope

This plan covers the NestJS backend in `track-a-project-backend`.

## P0 - Critical

| ID | Task | Why it matters | Primary files/areas | Status |
| --- | --- | --- | --- | --- |
| BE-P0-01 | Lock down CORS to approved frontend/admin origins | Current backend bootstrap accepts all origins, which is unsafe for production | `src/main.ts`, env config | Done |
| BE-P0-02 | Enable baseline security middleware | `helmet` and related protections are currently disabled | `src/main.ts` | Done |
| BE-P0-03 | Remove sensitive request and user logging | Request bodies, files, and user/password flow data are being logged in live code | `src/users/controllers`, `src/users/services`, other services with `console.log` | Done |
| BE-P0-04 | Audit auth and impersonation routes for proper guard coverage | Admin and impersonation paths should be explicitly protected and reviewed | `src/auth/controllers`, auth guards, admin guards | Done |
| BE-P0-05 | Define and validate required environment variables for production startup | Prevents broken deploys and unsafe fallback behavior | `src/config`, `.env.example`, startup docs | Done |

## P1 - High

| ID | Task | Why it matters | Primary files/areas | Status |
| --- | --- | --- | --- | --- |
| BE-P1-01 | Pin supported Node.js version and declare `engines` | Current toolchain is runtime-sensitive and fails on older Node versions | `package.json`, repo docs | Done |
| BE-P1-02 | Replace placeholder README with real backend setup and architecture docs | Onboarding is currently blocked by starter-template docs | `README.md` | Done |
| BE-P1-03 | Introduce structured logging strategy | Replaces scattered `console.log` usage with safer operational logging | app bootstrap, shared logging utilities, services | Done |
| BE-P1-04 | Review database `synchronize` usage and migration flow | Schema safety should rely on migrations, not runtime sync in shared environments | `src/app.module.ts`, migration scripts | Done |
| BE-P1-05 | Add smoke tests for auth, users, organizations, and permissions | Core flows currently lack meaningful automated coverage | `src/auth`, `src/users`, `src/organizations`, test setup | Done |
| BE-P1-06 | Add startup healthcheck and deployment verification steps | Makes deployments easier to validate and support | controller/module for health route, docs | Done |
| BE-P1-07 | Add HTTP rate limiting for auth and abuse-prone public endpoints | Reduces brute-force, spam, and recovery/invite abuse risk | `src/main.ts`, auth controllers, password recovery, invite endpoints | Done |
| BE-P1-08 | Decide, document, and validate Redis strategy | Needed for scalable throttling, caching, queues, and real-time coordination | `README.md`, `.env.example`, config, infra notes | Done |

## P2 - Medium

| ID | Task | Why it matters | Primary files/areas | Status |
| --- | --- | --- | --- | --- |
| BE-P2-01 | Clean up commented-out dead code and starter leftovers | Improves maintainability and reduces confusion | auth module/service, bootstrap, unused imports | Done |
| BE-P2-02 | Review module boundaries and reduce oversized service responsibilities | Some services appear large and difficult to test | `src/projects/services`, `src/users/services`, related modules | Done |
| BE-P2-03 | Standardize error responses across controllers/services | Improves frontend integration and debugging | controllers, DTO/service return patterns | Done |
| BE-P2-04 | Add audit checklist for uploads, storage, and socket gateways | These paths are higher-risk and deserve explicit review | `src/storage`, `src/resources`, `src/messages`, `src/whiteboards` | Done |
| BE-P2-05 | Expand `.env.example` and document secret ownership | Makes local setup and production config clearer | `.env.example`, `README.md` | Done |
| BE-P2-06 | Add websocket rate limiting and abuse controls | Prevents event flooding and room abuse in real-time features | `src/messages`, `src/notifications`, `src/projects`, `src/whiteboards` | Done |
| BE-P2-07 | Introduce background job and queue strategy for mail and notifications | Reduces request latency and makes retries/delivery more reliable | notifications, mailing, invite flows, Redis-backed queue choice | Done |

## P3 - Nice to Have

| ID | Task | Why it matters | Primary files/areas | Status |
| --- | --- | --- | --- | --- |
| BE-P3-01 | Add architectural diagrams or flow notes | Helps future contributors understand the system faster | `README.md` or docs folder | Done |
| BE-P3-02 | Add code ownership or maintenance notes by module | Clarifies responsibility for major areas | docs/process | Done |
| BE-P3-03 | Add cache policy notes for Redis-backed data | Prevents ad hoc caching and stale-data bugs later | docs, config, service boundaries | Done |

## Completion Tracking

Update the `Status` column as work progresses:
- Move to `In progress` when implementation begins
- Mark `Done` only after code, validation, and docs are finished
- Use `Blocked` if progress depends on another app, environment access, or a product decision
