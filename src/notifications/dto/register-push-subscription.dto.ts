import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PushSubscriptionKeysDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  p256dh: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  auth: string;
}

export class RegisterPushSubscriptionDto {
  @ApiProperty({ maxLength: 1024 })
  @IsString()
  @MaxLength(1024)
  endpoint: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
