import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Observable } from 'rxjs';

@Injectable()
export class AutomationRequestContextService {
  private readonly storage = new AsyncLocalStorage<{ userId: number | null }>();
  run<T>(userId: number | null, callback: () => T): T {
    return this.storage.run({ userId }, callback);
  }
  currentUserId() {
    return this.storage.getStore()?.userId ?? null;
  }
}

@Injectable()
export class AutomationRequestContextInterceptor implements NestInterceptor {
  constructor(private readonly context: AutomationRequestContextService) {}
  intercept(execution: ExecutionContext, next: CallHandler): Observable<any> {
    const request = execution.switchToHttp().getRequest();
    const userId = Number(request?.user?.userId) || null;
    return new Observable((subscriber) =>
      this.context.run(userId, () => next.handle().subscribe(subscriber)),
    );
  }
}
