import { IsString, MaxLength } from 'class-validator';

export class RemovePushSubscriptionDto {
  @IsString()
  @MaxLength(1024)
  endpoint: string;
}
