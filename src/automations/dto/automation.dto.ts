import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  Max,
} from 'class-validator';
import { AUTOMATION_RUN_STATES } from 'src/typeorm/entities/AutomationRun';
import { AUTOMATION_AUTHORIZATION_POLICIES } from 'src/typeorm/entities/AutomationRule';
import {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationTriggerType,
} from '../automation-contract';

export class AutomationTriggerDto {
  @IsEnum(AutomationTriggerType) type: AutomationTriggerType;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class AutomationConditionDto {
  @IsString() @IsNotEmpty() @MaxLength(120) field: string;
  @IsEnum(AutomationConditionOperator) operator: AutomationConditionOperator;
  @IsOptional() value?: unknown;
}

export class AutomationActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_]*$/)
  key: string;
  @IsEnum(AutomationActionType) type: AutomationActionType;
  @IsObject() config: Record<string, unknown>;
}

export class AutomationDefinitionDto {
  @ValidateNested()
  @Type(() => AutomationTriggerDto)
  trigger: AutomationTriggerDto;
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AutomationConditionDto)
  conditions: AutomationConditionDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions: AutomationActionDto[];
}

export class CreateAutomationRuleDto extends AutomationDefinitionDto {
  @IsString() @IsNotEmpty() @MaxLength(180) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional()
  @IsEnum(AUTOMATION_AUTHORIZATION_POLICIES)
  authorizationPolicy?: 'editor' | 'owner';
}

export class UpdateAutomationDraftDto extends AutomationDefinitionDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional()
  @IsEnum(AUTOMATION_AUTHORIZATION_POLICIES)
  authorizationPolicy?: 'editor' | 'owner';
}

export class ListAutomationRulesQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  includeArchived?: boolean;
}

export class AutomationRuleIdDto {
  @IsUUID('4') ruleId: string;
}

export class AutomationResourceIdDto {
  @IsInt() @Min(1) id: number;
}

export class DryRunAutomationDto {
  @IsOptional() @IsUUID('4') eventId?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class ListAutomationRunsQueryDto {
  @IsOptional() @IsUUID('4') ruleId?: string;
  @IsOptional() @IsIn(AUTOMATION_RUN_STATES) state?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
