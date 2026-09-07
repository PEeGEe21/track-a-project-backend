import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Task } from '../../typeorm/entities/Task';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description_html?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  tasks?: Task[];
}
