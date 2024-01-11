import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { config } from '../../config';

@Injectable()
export class VerifyHash implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const hash = config.verifyHash;

    const { headers } = context.switchToHttp().getRequest();
    let key = headers['verify-hash'];

    if (!key) {
      return false;
    }

    return key === hash;
  }
}
