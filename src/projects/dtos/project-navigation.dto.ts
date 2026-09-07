import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const PROJECT_NAVIGATION_SOURCES = [
  'pinned_sidebar',
  'project_card',
  'project_details',
  'search',
] as const;

export class ProjectNavigationDto {
  @ApiProperty({ enum: PROJECT_NAVIGATION_SOURCES })
  @IsIn(PROJECT_NAVIGATION_SOURCES)
  navigationSource: (typeof PROJECT_NAVIGATION_SOURCES)[number];
}
