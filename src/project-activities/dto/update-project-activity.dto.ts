import { PartialType } from '@nestjs/swagger';
import { CreateProjectActivityDto } from './create-project-activity.dto';

export class UpdateProjectActivityDto extends PartialType(CreateProjectActivityDto) {}
