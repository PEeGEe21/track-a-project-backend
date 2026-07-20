import { ArrayMaxSize, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class ReorderSidebarProjectsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  projectIds: number[];
}
