import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteWorkspaceDto {
  @ApiProperty({ description: 'Exact workspace name used as confirmation' })
  @IsString()
  @IsNotEmpty()
  confirmationName: string;
}
