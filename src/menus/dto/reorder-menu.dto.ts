// dto/reorder-menu.dto.ts
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class ReorderItemDto {
  @IsString()
  menuId: string;

  @IsNumber()
  newOrderIndex: number;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class ReorderMenusDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
