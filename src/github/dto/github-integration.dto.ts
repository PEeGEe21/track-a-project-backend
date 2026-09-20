import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGithubConnectionDto {
  @Type(() => Number) @IsInt() @Min(1) projectId: number;
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  @Length(3, 200)
  repository: string;
}
export class UpdateGithubConnectionDto {
  @IsOptional() @IsBoolean() active?: boolean;
}
export class RotateGithubSecretDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  overlapMinutes?: number;
}
export class LinkGithubArtifactDto {
  @IsString() @Length(8, 2048) artifactUrl: string;
}
export class MoveGithubArtifactDto {
  @Type(() => Number) @IsInt() @Min(1) targetTaskId: number;
}

export class ReplaceGithubArtifactTaskLinksDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  taskIds: number[];
}

export class GithubActivityQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional()
  @IsIn(['issue', 'pull_request', 'commit', 'deployment', 'release'])
  type?: string;
  @IsOptional()
  @IsIn(['all', 'linked', 'unlinked'])
  linked?: 'all' | 'linked' | 'unlinked' = 'all';
  @IsOptional() @IsString() @MaxLength(36) connectionId?: string;
  @IsOptional() @IsString() @MaxLength(200) repository?: string;
  @IsOptional() @IsString() @MaxLength(255) branch?: string;
  @IsOptional() @IsString() @MaxLength(160) actor?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(500) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
