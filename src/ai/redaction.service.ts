import { Injectable } from '@nestjs/common';
@Injectable()
export class RedactionService {
  redact(value: string) {
    return value
      .replace(
        /\b(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~-]{12,})\b/gi,
        '[REDACTED_CREDENTIAL]',
      )
      .replace(
        /\b(password|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi,
        '$1=[REDACTED]',
      );
  }
}
