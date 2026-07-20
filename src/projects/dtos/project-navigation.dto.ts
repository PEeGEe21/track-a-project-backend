import { IsIn } from 'class-validator';

export const PROJECT_NAVIGATION_SOURCES = [
  'pinned_sidebar',
  'project_card',
  'project_details',
  'search',
] as const;

export class ProjectNavigationDto {
  @IsIn(PROJECT_NAVIGATION_SOURCES)
  navigationSource: (typeof PROJECT_NAVIGATION_SOURCES)[number];
}
