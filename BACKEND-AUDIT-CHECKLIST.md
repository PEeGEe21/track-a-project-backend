# Backend Audit Checklist

Use this checklist when reviewing higher-risk backend paths before release.

## Uploads And Storage

- Confirm file uploads enforce size limits and allowed MIME types.
- Confirm uploaded filenames and paths are sanitized before persistence.
- Confirm private files use signed URLs where required.
- Confirm public URL generation is intentional and documented.
- Confirm bucket permissions match the expected visibility model.
- Confirm failed upload, delete, and move operations are logged without leaking file contents or secrets.
- Review [src/storage/supabase-storage.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/storage/supabase-storage.service.ts).
- Review [src/resources/services/resources.service.ts](/var/www/html/trackr-main/track-a-project-backend/src/resources/services/resources.service.ts).

## Resources And Documents

- Confirm organization and project ownership checks are applied consistently.
- Confirm resource metadata cannot be attached across tenant boundaries.
- Confirm document preview and download flows respect authorization.
- Confirm destructive actions emit audit-friendly logs.
- Review [src/resources](/var/www/html/trackr-main/track-a-project-backend/src/resources).
- Review [src/documents](/var/www/html/trackr-main/track-a-project-backend/src/documents).

## Socket Gateways

- Confirm gateway CORS origins stay aligned with backend origin policy.
- Confirm clients authenticate before joining tenant or project rooms.
- Confirm room names cannot be forged to access another organization.
- Confirm broadcast payloads do not include secrets, tokens, or private metadata.
- Confirm rate limiting or abuse controls exist for high-volume events.
- Confirm disconnect cleanup removes stale room and user mappings.
- Review [src/messages/messages.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/messages/messages.gateway.ts).
- Review [src/notifications/notifications.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/notifications/notifications.gateway.ts).
- Review [src/projects/projects.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/projects/projects.gateway.ts).
- Review [src/whiteboards/whiteboards.gateway.ts](/var/www/html/trackr-main/track-a-project-backend/src/whiteboards/whiteboards.gateway.ts).

## Tenant Safety

- Confirm organization-scoped routes reject missing or mismatched organization IDs.
- Confirm invite links and onboarding flows use configured frontend URLs only.
- Confirm background jobs and notifications preserve tenant context.
- Confirm audit logs capture impersonation, invitation, and membership changes.

## Release Sign-Off

- Record reviewer name and date.
- Note any accepted risk or deferred follow-up item.
- Link the PR or incident ticket that triggered the review.
