import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
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
