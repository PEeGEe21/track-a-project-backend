import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Task } from '../../typeorm/entities/Task';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  description_html?: string;

  @IsOptional()
  @IsArray()
  tasks?: Task[];
}
