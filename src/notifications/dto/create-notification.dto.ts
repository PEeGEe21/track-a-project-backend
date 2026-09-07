import { User } from 'src/typeorm/entities/User';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  recipient: User;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  sender?: User | null;
  @ApiProperty()
  title: string;
  @ApiPropertyOptional()
  message?: string;
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, any>;
}
