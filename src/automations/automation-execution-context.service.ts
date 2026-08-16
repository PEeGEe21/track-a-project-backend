import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type AutomationExecutionContext = {
  actorId: string;
  causationEventId: string;
  correlationId: string;
  ancestorRuleIds: string[];
  chainDepth: number;
  actionCount: number;
};

@Injectable()
export class AutomationExecutionContextService {
  private readonly storage =
    new AsyncLocalStorage<AutomationExecutionContext>();
  run<T>(context: AutomationExecutionContext, callback: () => Promise<T>) {
    return this.storage.run(context, callback);
  }
  current() {
    return this.storage.getStore() ?? null;
  }
}
