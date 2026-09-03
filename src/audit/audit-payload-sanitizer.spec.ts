import { AuditSubjectType } from './audit-contract';
import { AuditPayloadSanitizer } from './audit-payload-sanitizer';

describe('AuditPayloadSanitizer', () => {
  const sanitizer = new AuditPayloadSanitizer();

  it('keeps only subject-allowlisted changed fields', () => {
    expect(
      sanitizer.sanitizeChanges(AuditSubjectType.TASK, {
        title: 'Visible',
        description: 'Never stored',
        custom_fields_changed: 3,
      }),
    ).toEqual({ title: 'Visible', custom_fields_changed: 3 });
  });

  it('removes denied keys recursively and bounds collections and strings', () => {
    const result = sanitizer.sanitizeMetadata({
      safe: { token: 'secret', nested: { label: 'x'.repeat(600) } },
      authorization_header: 'Bearer secret',
      ids: Array.from({ length: 60 }, (_, index) => index),
    });

    expect(result).toEqual({
      safe: { nested: { label: 'x'.repeat(500) } },
      ids: Array.from({ length: 50 }, (_, index) => index),
    });
  });

  it('replaces over-depth data and bounds oversized metadata', () => {
    expect(
      sanitizer.sanitizeMetadata({
        a: { b: { c: { d: { e: { f: 'hidden' } } } } },
      }),
    ).toEqual({
      a: { b: { c: { d: { e: { f: '[depth-limited]' } } } } },
    });
    expect(sanitizer.sanitizeMetadata({ safe: 'x'.repeat(20_000) })).toEqual({
      safe: 'x'.repeat(500),
    });
    expect(
      sanitizer.sanitizeMetadata(
        Object.fromEntries(
          Array.from({ length: 40 }, (_, index) => [
            `safe_${index}`,
            'x'.repeat(500),
          ]),
        ),
      ),
    ).toEqual({ truncated: true });
  });
});
