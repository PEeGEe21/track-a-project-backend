import { IsEnum } from 'class-validator';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProjectMemberRoleDto {
  @ApiProperty({ enum: ProjectRole })
  @IsEnum(ProjectRole)
  role: ProjectRole;
}
