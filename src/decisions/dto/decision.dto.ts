import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DecisionStatus } from 'src/typeorm/entities/Decision';
import { DecisionLinkType } from 'src/typeorm/entities/DecisionLink';
export class DecisionLinkDto {
  @IsEnum(DecisionLinkType) type: DecisionLinkType;
  @IsString() @MaxLength(64) id: string;
  @IsOptional() @IsString() @MaxLength(255) label?: string;
}
export class SaveDecisionDto {
  @IsString() @MaxLength(255) title: string;
  @IsString() context: string;
  @Type(() => Number) @IsInt() owner_id: number;
  @IsDateString() decision_date: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DecisionLinkDto)
  links?: DecisionLinkDto[];
}
export class TransitionDecisionDto {
  @IsEnum(DecisionStatus) status: DecisionStatus;
}
