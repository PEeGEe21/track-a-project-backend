import { AuditRequestContextService } from './audit-request-context.service';

describe('AuditRequestContextService', () => {
  it('preserves one request and correlation identity across async work', async () => {
    const service = new AuditRequestContextService();

    await service.run(
      { requestId: 'request-1', correlationId: 'correlation-1' },
      async () => {
        await Promise.resolve();
        expect(service.current()).toEqual({
          requestId: 'request-1',
          correlationId: 'correlation-1',
        });
        expect(service.correlationId()).toBe('correlation-1');
      },
    );
  });

  it('creates an identity for non-HTTP work without a request context', () => {
    expect(serviceId(new AuditRequestContextService())).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
});

function serviceId(service: AuditRequestContextService) {
  return service.correlationId();
}
