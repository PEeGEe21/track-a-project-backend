import * as crypto from 'crypto';
import { config } from '../config'; // adjust to your actual config import path

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashInviteCode(code: string): string {
  const secret = config.inviteCodeSecret;

  if (!secret) {
    throw new Error('INVITE_CODE_SECRET is not configured');
  }

  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}
