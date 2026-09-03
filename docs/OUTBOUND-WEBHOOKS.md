# Outbound webhooks

Reliable Integration Delivery publishes committed, allowlisted audit events to organization-managed HTTPS endpoints. The capability key is `reliable_integration_delivery` and remains disabled unless explicitly enabled for an organization.

## Envelope

Every production request contains the exact UTF-8 JSON bytes for this versioned shape:

```json
{
  "version": 1,
  "deliveryId": "delivery-uuid",
  "event": {
    "id": "original-audit-event-uuid",
    "occurredAt": "2026-09-03T10:00:00.000Z",
    "organizationId": "organization-uuid",
    "projectId": 42,
    "action": "task.updated",
    "outcome": "succeeded",
    "actor": { "type": "human", "id": "7", "label": "Workspace member" },
    "subject": { "type": "task", "id": "91", "label": "Task" },
    "correlationId": "correlation-id",
    "causationId": null,
    "before": {},
    "after": {},
    "metadata": {}
  }
}
```

Before/after and metadata use the central audit sanitizer. Secrets, credentials, message bodies, file contents, and denied fields are never included. Test requests set `test: true`, use a synthetic `integration.test` event, and do not create an audit event.

## Verification

Requests include:

- `x-tailpoint-delivery`: stable delivery UUID
- `x-tailpoint-event`: original audit event UUID
- `x-tailpoint-timestamp`: Unix time in seconds
- `x-tailpoint-signature`: one or more comma-separated `sha256=<hex>` values

For each signature candidate, calculate HMAC-SHA256 over the exact bytes `timestamp + "." + raw_request_body` using the endpoint secret and compare in constant time. Reject stale timestamps according to the receiver's replay window. During a rotation overlap, Tailpoint signs with both the new and previous secrets; accept the request if either signature verifies.

## Delivery behavior

- Any 2xx response succeeds.
- 408, 425, 429, 5xx, timeouts, and network failures retry with bounded exponential backoff and jitter. A valid `Retry-After` value is honored up to one hour.
- Other 4xx responses fail permanently.
- Redirects are not followed. DNS is revalidated before every request and the validated public address is pinned for the connection.
- Eight failed attempts place the delivery in `dead_letter`.
- An authorized replay creates a new delivery generation while preserving the original event ID.

Receivers must deduplicate on `x-tailpoint-delivery`. When business processing is keyed to the source mutation, also retain `x-tailpoint-event`; replays intentionally use a new delivery ID for the same event ID.
