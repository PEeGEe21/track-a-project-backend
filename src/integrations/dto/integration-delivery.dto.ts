import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  IsUUID,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INTEGRATION_DELIVERY_STATES } from 'src/typeorm/entities/IntegrationDelivery';

export class CreateIntegrationEndpointDto {
  @IsString() @Length(1, 160) name: string;
  @IsUrl({ protocols: ['https'], require_protocol: true }) url: string;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) actions: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) projectId?: number;
}

export class UpdateIntegrationEndpointDto {
  @IsOptional() @IsString() @Length(1, 160) name?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  actions?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class RotateIntegrationSecretDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  overlapMinutes?: number;
}

export class ReplayIntegrationDeliveryDto {
  @IsString() @Length(3, 500) reason: string;
}

export class ListIntegrationDeliveriesDto {
  @IsOptional() @IsUUID() endpointId?: string;
  @IsOptional() @IsIn(INTEGRATION_DELIVERY_STATES) state?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) projectId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
