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
export class CreateApprovalDto {
  @IsEnum(ApprovalSubjectType) subjectType: ApprovalSubjectType;
  @IsString() @IsNotEmpty() @MaxLength(64) subjectId: string;
  @IsArray()
  @ValidateIf((value) => !value.stages?.length)
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  reviewerIds?: number[];
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsBoolean() rejectionCommentRequired?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalStageDto)
  stages?: ApprovalStageDto[];
}
export class ApprovalStageDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  reviewerIds: number[];
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  optionalReviewerIds?: number[];
  @IsString() policy: 'unanimous' | 'threshold';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) threshold?: number;
}
export class DelegateApprovalDto {
  @Type(() => Number) @IsInt() delegateToUserId: number;
}
export class RespondApprovalDto {
  @IsEnum(ApprovalDecision) decision: ApprovalDecision;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
