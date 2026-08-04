import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Allow,
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CustomFieldValue } from '../custom-field-type';

export class TaskCustomFieldValueDto {
  @IsString()
  fieldId: string;

  @Allow()
  value: CustomFieldValue;
}

export class SetTaskCustomFieldValuesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TaskCustomFieldValueDto)
  values: TaskCustomFieldValueDto[];
}
