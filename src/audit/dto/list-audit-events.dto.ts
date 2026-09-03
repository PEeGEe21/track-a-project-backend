import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditActorType, AuditOutcome, AuditSource, AuditSubjectType } from '../audit-contract';

export class ListAuditEventsDto {
  @IsOptional() @IsString() @MaxLength(500) cursor?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit?: number = 50;
  @IsOptional() @IsString() @MaxLength(40) from?: string;
  @IsOptional() @IsString() @MaxLength(40) to?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) projectId?: number;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @IsIn(Object.values(AuditActorType)) actorType?: AuditActorType;
  @IsOptional() @IsString() @MaxLength(80) actorId?: string;
  @IsOptional() @IsIn(Object.values(AuditSubjectType)) subjectType?: AuditSubjectType;
  @IsOptional() @IsString() @MaxLength(80) subjectId?: string;
  @IsOptional() @IsIn(Object.values(AuditSource)) source?: AuditSource;
  @IsOptional() @IsIn(Object.values(AuditOutcome)) outcome?: AuditOutcome;
  @IsOptional() @IsString() @MaxLength(80) correlationId?: string;
}
