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
} from 'class-validator';
import { ApprovalDecision } from 'src/typeorm/entities/ApprovalResponse';
import { ApprovalSubjectType } from 'src/typeorm/entities/ApprovalRequest';
export class CreateApprovalDto {
  @IsEnum(ApprovalSubjectType) subjectType: ApprovalSubjectType;
  @IsString() @IsNotEmpty() @MaxLength(64) subjectId: string;
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  reviewerIds: number[];
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsBoolean() rejectionCommentRequired?: boolean;
}
export class RespondApprovalDto {
  @IsEnum(ApprovalDecision) decision: ApprovalDecision;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
