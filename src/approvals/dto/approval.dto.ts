import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApprovalDecision } from 'src/typeorm/entities/ApprovalResponse';
import { ApprovalSubjectType } from 'src/typeorm/entities/ApprovalRequest';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreateApprovalDto {
  @ApiProperty({ enum: ApprovalSubjectType })
  @IsEnum(ApprovalSubjectType)
  subjectType: ApprovalSubjectType;
  @ApiProperty({ maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  subjectId: string;
  @ApiPropertyOptional({ type: [Number], minItems: 1 })
  @IsArray()
  @ValidateIf((value) => !value.stages?.length)
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  reviewerIds?: number[];
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rejectionCommentRequired?: boolean;
  @ApiPropertyOptional({ type: () => [ApprovalStageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalStageDto)
  stages?: ApprovalStageDto[];
}
export class ApprovalStageDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
  @ApiProperty({ type: [Number], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  reviewerIds: number[];
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  optionalReviewerIds?: number[];
  @ApiProperty({ enum: ['unanimous', 'threshold'] })
  @IsString()
  policy: 'unanimous' | 'threshold';
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  threshold?: number;
}
export class DelegateApprovalDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  delegateToUserId: number;
}
export class RespondApprovalDto {
  @ApiProperty({ enum: ApprovalDecision })
  @IsEnum(ApprovalDecision)
  decision: ApprovalDecision;
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
