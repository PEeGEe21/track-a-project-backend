# Entitlement Foundation

The backend is the sole authority for feature availability. It combines the capability catalog, subscription tier, organization override, and active user membership into one result.

## Add a capability

1. Add a stable key and definition to `src/entitlements/capability-catalog.ts`.
2. Keep unfinished capabilities `defaultEnabled: false`.
3. Protect every feature API with `OrganizationAccessGuard`, `CapabilityGuard`, and `@RequireCapability(CapabilityKey.X)`.
4. Consume `GET /entitlements` in the workspace; do not reconstruct plan or override logic in a frontend.
5. Use `CapabilityGate` or `filterNavigationByEntitlements` for workspace presentation.
6. Use the organization Entitlements tab in `tracker-admin` for pilot overrides.

An override cannot bypass a capability's minimum subscription tier or active organization membership. `null` means inherit the catalog default, `true` forces rollout on, and `false` forces rollout off. Override changes are written to `audit_logs`.

## Release sequence

Run the organization feature-overrides migration before deploying code that reads overrides. Register and deploy the backend capability before exposing its workspace navigation. Enable the capability only for pilot organizations until feature acceptance criteria pass.
