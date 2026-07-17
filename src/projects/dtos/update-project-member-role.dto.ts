import { IsEnum } from 'class-validator';
import { ProjectRole } from 'src/utils/constants/projectRole';

export class UpdateProjectMemberRoleDto {
  @IsEnum(ProjectRole)
  role: ProjectRole;
}
