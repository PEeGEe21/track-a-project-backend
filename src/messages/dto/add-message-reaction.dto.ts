import { IsString, Length } from 'class-validator';

export class AddMessageReactionDto {
  @IsString()
  @Length(1, 10)
  emoji: string;
}
