import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ProjectUpdateHealth } from 'src/typeorm/entities/ProjectUpdate';
import { ProjectUpdateReferenceType } from 'src/typeorm/entities/ProjectUpdateReference';

export class ProjectUpdateReferenceDto {
  @IsEnum(ProjectUpdateReferenceType) type: ProjectUpdateReferenceType;
  @IsString() @MaxLength(64) id: string;
  @IsOptional() @IsString() @MaxLength(255) label?: string;
}

export class SaveProjectUpdateDto {
  @IsEnum(ProjectUpdateHealth) health: ProjectUpdateHealth;
  @IsOptional() @IsString() accomplishments?: string;
  @IsOptional() @IsString() blockers?: string;
  @IsOptional() @IsString() next_steps?: string;
  @IsOptional() @IsDateString() reporting_period_start?: string;
  @IsOptional() @IsDateString() reporting_period_end?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectUpdateReferenceDto) references?: ProjectUpdateReferenceDto[];
}
