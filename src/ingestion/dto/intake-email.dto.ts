import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class CreateIntakeEmailAddressDto {
  @IsString() @MaxLength(180) name: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  spamThreshold?: number;
}
export class UpdateIntakeEmailAddressDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  spamThreshold?: number;
}
