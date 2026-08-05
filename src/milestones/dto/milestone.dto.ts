import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MilestoneHealth,
  MilestoneStatus,
} from 'src/typeorm/entities/Milestone';

export class MilestoneTaskLinkDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId: number;

  @IsOptional()
  @IsBoolean()
  countsTowardProgress?: boolean;
}

export class CreateMilestoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  completionCriteria?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  targetDate?: string | null;

  @IsOptional()
  @IsEnum(MilestoneHealth)
  health?: MilestoneHealth;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ownerId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneTaskLinkDto)
  taskLinks?: MilestoneTaskLinkDto[];
}

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  completionCriteria?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  targetDate?: string | null;

  @IsOptional()
  @IsEnum(MilestoneHealth)
  health?: MilestoneHealth;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ownerId?: number | null;
}

export class ReplaceMilestoneTasksDto {
  @IsArray()
  @ArrayUnique((link: MilestoneTaskLinkDto) => link.taskId)
  @ValidateNested({ each: true })
  @Type(() => MilestoneTaskLinkDto)
  taskLinks: MilestoneTaskLinkDto[];
}

export class TransitionMilestoneDto {
  @IsEnum(MilestoneStatus)
  status: MilestoneStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class MilestoneListQueryDto {
  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;

  @IsOptional()
  @IsEnum(MilestoneHealth)
  health?: MilestoneHealth;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ownerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
