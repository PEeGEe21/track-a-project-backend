import { IsIn } from 'class-validator';

export class ChangePlanDto {
  @IsIn(['free', 'basic', 'pro', 'enterprise'])
  planCode: 'free' | 'basic' | 'pro' | 'enterprise';
}
