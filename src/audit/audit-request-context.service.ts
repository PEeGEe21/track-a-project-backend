import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

type AuditRequestContext = {
  requestId: string;
  correlationId: string;
};

@Injectable()
export class AuditRequestContextService {
  private readonly storage = new AsyncLocalStorage<AuditRequestContext>();

  run<T>(context: AuditRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  current() {
    return this.storage.getStore() ?? null;
  }

  correlationId() {
    return this.current()?.correlationId ?? randomUUID();
  }
}

@Injectable()
export class AuditRequestContextInterceptor implements NestInterceptor {
  constructor(private readonly context: AuditRequestContextService) {}

  intercept(execution: ExecutionContext, next: CallHandler): Observable<any> {
    const request = execution.switchToHttp().getRequest();
    const supplied = request?.headers?.['x-request-id'];
    const requestId =
      typeof supplied === 'string' && supplied.trim()
        ? supplied.trim().slice(0, 80)
        : randomUUID();
    return new Observable((subscriber) =>
      this.context.run({ requestId, correlationId: requestId }, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
