import { PartialType } from '@nestjs/swagger';
import { CreateUserpeerDto } from './create-userpeer.dto';

export class UpdateUserpeerDto extends PartialType(CreateUserpeerDto) {}
