import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemovePushSubscriptionDto {
  @ApiProperty({ maxLength: 1024 })
  @IsString()
  @MaxLength(1024)
  endpoint: string;
}
