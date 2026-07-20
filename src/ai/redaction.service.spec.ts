import { RedactionService } from './redaction.service';
describe('RedactionService', () => {
  it('redacts credentials before provider submission', () => {
    const result = new RedactionService().redact(
      'api_key=secret-value password: hunter2 Bearer abcdefghijklmnop',
    );
    expect(result).not.toContain('secret-value');
    expect(result).not.toContain('hunter2');
    expect(result).not.toContain('abcdefghijklmnop');
  });
});
