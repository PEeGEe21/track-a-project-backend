import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class AttachResourceTaskDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  taskId: number;
}
