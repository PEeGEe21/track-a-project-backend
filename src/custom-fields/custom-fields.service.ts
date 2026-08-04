import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { ProjectRolePolicy } from 'src/common/authorization/project-role.policy';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { CustomFieldOption } from 'src/typeorm/entities/CustomFieldOption';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import { Task } from 'src/typeorm/entities/Task';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { AuthUser } from 'src/types/users';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';
import { ActivityType } from 'src/utils/constants/activity';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { CustomFieldType } from './custom-field-type';
import {
  CreateCustomFieldDefinitionDto,
  ReorderCustomFieldsDto,
  UpdateCustomFieldDefinitionDto,
} from './dto/custom-field-definition.dto';
import { TaskCustomFieldValueDto } from './dto/task-custom-field-values.dto';

const SELECT_TYPES = new Set([
  CustomFieldType.SINGLE_SELECT,
  CustomFieldType.MULTI_SELECT,
]);

export type PreparedCustomFieldFilter = {
  fieldId: string;
  type: CustomFieldType;
  operator: string;
  value?: string | number | boolean | string[] | number[];
};

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authorization: AuthorizationService,
    @InjectRepository(CustomFieldDefinition)
    private readonly definitions: Repository<CustomFieldDefinition>,
    @InjectRepository(TaskCustomFieldValue)
    private readonly values: Repository<TaskCustomFieldValue>,
    private readonly activities: ProjectActivitiesService,
  ) {}

  async list(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    includeArchived = false,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    return this.definitions.find({
      where: {
        organization_id: organizationId,
        project_id: projectId,
        ...(includeArchived ? {} : { archived_at: IsNull() }),
      },
      relations: ['options'],
      order: {
        position: 'ASC',
        created_at: 'ASC',
        options: { position: 'ASC' },
      },
    });
  }

  async getTaskValues(actor: AuthUser, organizationId: string, taskId: number) {
    const task = await this.getAuthorizedTask(
      actor,
      organizationId,
      taskId,
      ProjectPermission.VIEW,
    );
    return this.serializeTaskValues(organizationId, task.project.id, task.id);
  }

  async prepareFilters(
    organizationId: string,
    filters: Array<{ fieldId: string; operator: string; value?: unknown }>,
  ): Promise<PreparedCustomFieldFilter[]> {
    if (!filters?.length) return [];
    const supportedOperators = new Set([
      'eq',
      'neq',
      'contains',
      'gt',
      'gte',
      'lt',
      'lte',
      'is_empty',
      'is_not_empty',
    ]);
    if (filters.some((filter) => !supportedOperators.has(filter.operator))) {
      throw new BadRequestException('Unsupported custom field filter operator');
    }
    const fieldIds = filters.map((filter) => filter.fieldId);
    if (new Set(fieldIds).size !== fieldIds.length) {
      throw new BadRequestException('Custom field filters must be unique');
    }
    const definitions = await this.definitions.find({
      where: {
        id: In(fieldIds),
        organization_id: organizationId,
        archived_at: IsNull(),
      },
      relations: ['options'],
    });
    const byId = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );
    if (definitions.length !== fieldIds.length) {
      throw new BadRequestException(
        'Every custom field filter must reference an active organization field',
      );
    }

    return Promise.all(
      filters.map(async (filter) => {
        const definition = byId.get(filter.fieldId)!;
        const emptyOperator =
          filter.operator === 'is_empty' || filter.operator === 'is_not_empty';
        const comparisonOperator = ['gt', 'gte', 'lt', 'lte'].includes(
          filter.operator,
        );
        if (
          comparisonOperator &&
          definition.type !== CustomFieldType.NUMBER &&
          definition.type !== CustomFieldType.DATE
        ) {
          throw new BadRequestException(
            `Operator ${filter.operator} is not supported for ${definition.type}`,
          );
        }
        if (
          filter.operator === 'contains' &&
          ![
            CustomFieldType.TEXT,
            CustomFieldType.URL,
            CustomFieldType.MULTI_SELECT,
          ].includes(definition.type)
        ) {
          throw new BadRequestException(
            `Operator contains is not supported for ${definition.type}`,
          );
        }
        if (emptyOperator) {
          return {
            fieldId: filter.fieldId,
            type: definition.type,
            operator: filter.operator,
          };
        }
        if (filter.value === undefined || filter.value === null) {
          throw new BadRequestException(
            `Operator ${filter.operator} requires a value`,
          );
        }
        const value =
          filter.operator === 'contains' &&
          definition.type === CustomFieldType.MULTI_SELECT
            ? (
                await this.normalizeValue(
                  this.dataSource.manager,
                  organizationId,
                  definition,
                  [filter.value],
                )
              )[0]
            : await this.normalizeValue(
                this.dataSource.manager,
                organizationId,
                definition,
                filter.value,
              );
        return {
          fieldId: filter.fieldId,
          type: definition.type,
          operator: filter.operator,
          value,
        };
      }),
    );
  }

  async setTaskValues(
    actor: AuthUser,
    organizationId: string,
    taskId: number,
    inputs: TaskCustomFieldValueDto[],
  ) {
    const task = await this.getAuthorizedTask(
      actor,
      organizationId,
      taskId,
      ProjectPermission.CONTRIBUTE,
    );
    await this.dataSource.transaction((manager) =>
      this.setTaskValuesInTransaction(
        manager,
        organizationId,
        task.project.id,
        task.id,
        inputs,
        false,
      ),
    );
    await this.activities.createActivity({
      organization_id: organizationId,
      projectId: task.project.id,
      userId: actor.userId,
      activityType: ActivityType.TASK_UPDATED,
      description: `Updated custom fields on task "${task.title}"`,
      entityType: 'task',
      entityId: task.id,
      metadata: {
        changedCustomFieldIds: inputs.map((input) => input.fieldId),
      },
    });
    return this.serializeTaskValues(organizationId, task.project.id, task.id);
  }

  async setTaskValuesInTransaction(
    manager: EntityManager,
    organizationId: string,
    projectId: number,
    taskId: number,
    inputs: TaskCustomFieldValueDto[],
    applyDefaults: boolean,
  ) {
    const definitions = await manager
      .getRepository(CustomFieldDefinition)
      .find({
        where: {
          organization_id: organizationId,
          project_id: projectId,
          archived_at: IsNull(),
        },
        relations: ['options'],
        order: { position: 'ASC', options: { position: 'ASC' } },
      });
    const definitionById = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );
    const inputIds = inputs.map((input) => input.fieldId);
    if (new Set(inputIds).size !== inputIds.length) {
      throw new BadRequestException('Custom field ids must be unique');
    }
    for (const fieldId of inputIds) {
      if (!definitionById.has(fieldId)) {
        throw new BadRequestException(
          `Custom field ${fieldId} is unavailable for this project`,
        );
      }
    }

    const valueRepo = manager.getRepository(TaskCustomFieldValue);
    const existing = applyDefaults
      ? []
      : await valueRepo.find({ where: { task_id: taskId } });
    const finalValues = new Map(
      existing.map((entry) => [entry.definition_id, entry.value]),
    );

    if (applyDefaults) {
      for (const definition of definitions) {
        if (definition.default_value !== null) {
          finalValues.set(
            definition.id,
            await this.normalizeValue(
              manager,
              organizationId,
              definition,
              definition.default_value,
            ),
          );
        }
      }
    }
    for (const input of inputs) {
      const definition = definitionById.get(input.fieldId)!;
      if (input.value === null) {
        finalValues.delete(input.fieldId);
      } else {
        finalValues.set(
          input.fieldId,
          await this.normalizeValue(
            manager,
            organizationId,
            definition,
            input.value,
          ),
        );
      }
    }

    const missing = definitions.filter(
      (definition) =>
        definition.required &&
        !this.hasRequiredValue(finalValues.get(definition.id)),
    );
    if (missing.length) {
      throw new BadRequestException({
        message: 'Required custom fields are missing',
        fields: missing.map((definition) => ({
          id: definition.id,
          key: definition.key,
          name: definition.name,
        })),
      });
    }

    const touchedIds = applyDefaults
      ? definitions.map((definition) => definition.id)
      : inputIds;
    if (touchedIds.length) {
      await valueRepo.delete({
        task_id: taskId,
        definition_id: In(touchedIds),
      });
    }
    const rows = touchedIds
      .filter((definitionId) => finalValues.has(definitionId))
      .map((definitionId) =>
        valueRepo.create({
          task_id: taskId,
          definition_id: definitionId,
          value: finalValues.get(definitionId)!,
        }),
      );
    if (rows.length) await valueRepo.save(rows);
    return finalValues;
  }

  async serializeTaskValues(
    organizationId: string,
    projectId: number,
    taskId: number,
  ) {
    const serialized = await this.serializeTasks(organizationId, [
      { id: taskId, projectId },
    ]);
    return serialized.get(taskId) ?? [];
  }

  async serializeTasks(
    organizationId: string,
    tasks: Array<{ id: number; projectId: number }>,
  ) {
    const taskIds = [...new Set(tasks.map((task) => task.id))];
    const projectIds = [...new Set(tasks.map((task) => task.projectId))];
    const result = new Map<number, any[]>();
    for (const taskId of taskIds) result.set(taskId, []);
    if (!taskIds.length || !projectIds.length) return result;

    const definitions = await this.definitions.find({
      where: {
        organization_id: organizationId,
        project_id: In(projectIds),
      },
      relations: ['options'],
      order: { position: 'ASC', options: { position: 'ASC' } },
    });
    const values = await this.values.find({
      where: { task_id: In(taskIds) },
    });
    const valuesByTask = new Map<number, Map<string, unknown>>();
    for (const entry of values) {
      const taskValues = valuesByTask.get(entry.task_id) ?? new Map();
      taskValues.set(entry.definition_id, entry.value);
      valuesByTask.set(entry.task_id, taskValues);
    }
    const definitionsByProject = new Map<number, CustomFieldDefinition[]>();
    for (const definition of definitions) {
      const projectDefinitions =
        definitionsByProject.get(definition.project_id) ?? [];
      projectDefinitions.push(definition);
      definitionsByProject.set(definition.project_id, projectDefinitions);
    }
    for (const task of tasks) {
      const taskValues = valuesByTask.get(task.id) ?? new Map();
      result.set(
        task.id,
        (definitionsByProject.get(task.projectId) ?? [])
          .filter(
            (definition) =>
              !definition.archived_at || taskValues.has(definition.id),
          )
          .map((definition) => ({
            fieldId: definition.id,
            key: definition.key,
            name: definition.name,
            type: definition.type,
            required: definition.required,
            archived: Boolean(definition.archived_at),
            value: taskValues.get(definition.id) ?? null,
            options: definition.options.map((option) => ({
              key: option.key,
              label: option.label,
              color: option.color,
              archived: Boolean(option.archived_at),
            })),
          })),
      );
    }
    return result;
  }

  async create(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    dto: CreateCustomFieldDefinitionDto,
  ) {
    await this.assertManage(actor, organizationId, projectId);
    this.assertOptions(dto.type, dto.options);
    const normalizedDefault =
      dto.defaultValue === undefined || dto.defaultValue === null
        ? null
        : await this.normalizeValue(
            this.dataSource.manager,
            organizationId,
            {
              id: dto.key,
              key: dto.key,
              name: dto.name,
              type: dto.type,
              options: (dto.options ?? []).map((option) => ({
                ...option,
                archived_at: null,
              })),
            } as CustomFieldDefinition,
            dto.defaultValue,
          );

    const created = await this.dataSource.transaction(async (manager) => {
      const definitionRepo = manager.getRepository(CustomFieldDefinition);
      const optionRepo = manager.getRepository(CustomFieldOption);
      const position = await definitionRepo.count({
        where: { organization_id: organizationId, project_id: projectId },
      });
      const definition = await definitionRepo.save(
        definitionRepo.create({
          organization_id: organizationId,
          project_id: projectId,
          key: dto.key.trim().toLowerCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          type: dto.type,
          required: dto.required ?? false,
          position,
          default_value: normalizedDefault,
          archived_at: null,
          created_by_id: actor.userId,
        }),
      );
      if (dto.options?.length) {
        await optionRepo.save(
          dto.options.map((option, index) =>
            optionRepo.create({
              definition_id: definition.id,
              key: option.key.trim().toLowerCase(),
              label: option.label.trim(),
              color: option.color?.trim() || null,
              position: index,
              archived_at: null,
            }),
          ),
        );
      }
      return definitionRepo.findOne({
        where: { id: definition.id },
        relations: ['options'],
      });
    });
    if (!created) throw new NotFoundException('Custom field was not created');
    await this.recordActivity(
      actor,
      organizationId,
      projectId,
      'created',
      created,
    );
    return created;
  }

  async update(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    fieldId: string,
    dto: UpdateCustomFieldDefinitionDto,
  ) {
    await this.assertManage(actor, organizationId, projectId);
    const definition = await this.getDefinition(
      organizationId,
      projectId,
      fieldId,
    );
    const nextType = dto.type ?? definition.type;
    this.assertOptions(nextType, dto.options);
    if (dto.type && dto.type !== definition.type) {
      if (
        (await this.values.count({ where: { definition_id: fieldId } })) > 0
      ) {
        throw new BadRequestException(
          'A field with task values cannot change type',
        );
      }
    }
    const nextDefault =
      dto.defaultValue !== undefined
        ? dto.defaultValue
        : definition.default_value;
    const normalizedDefault =
      nextDefault == null
        ? null
        : await this.normalizeValue(
            this.dataSource.manager,
            organizationId,
            {
              ...definition,
              type: nextType,
              options: dto.options
                ? dto.options.map((option) => ({
                    ...option,
                    archived_at: null,
                  }))
                : definition.options,
            } as CustomFieldDefinition,
            nextDefault,
          );

    const previousType = definition.type;
    const changedProperties = Object.keys(dto);
    const updated = await this.dataSource.transaction(async (manager) => {
      const definitionRepo = manager.getRepository(CustomFieldDefinition);
      const optionRepo = manager.getRepository(CustomFieldOption);
      definition.name = dto.name?.trim() ?? definition.name;
      if (dto.description !== undefined) {
        definition.description = dto.description?.trim() || null;
      }
      definition.type = nextType;
      definition.required = dto.required ?? definition.required;
      definition.default_value = normalizedDefault;
      await definitionRepo.save(definition);

      if (dto.options) {
        const existing = await optionRepo.find({
          where: { definition_id: definition.id },
        });
        const byKey = new Map(existing.map((option) => [option.key, option]));
        const requestedKeys = new Set<string>();
        for (const [position, input] of dto.options.entries()) {
          const key = input.key.trim().toLowerCase();
          requestedKeys.add(key);
          const option =
            byKey.get(key) ??
            optionRepo.create({ definition_id: definition.id, key });
          option.label = input.label.trim();
          option.color = input.color?.trim() || null;
          option.position = position;
          option.archived_at = null;
          await optionRepo.save(option);
        }
        for (const option of existing) {
          if (!requestedKeys.has(option.key) && !option.archived_at) {
            option.archived_at = new Date();
            await optionRepo.save(option);
          }
        }
      }
      return definitionRepo.findOne({
        where: { id: definition.id },
        relations: ['options'],
      });
    });
    if (!updated) throw new NotFoundException('Custom field was not updated');
    await this.recordActivity(
      actor,
      organizationId,
      projectId,
      'updated',
      updated,
      {
        changedProperties,
        previousType: previousType === updated.type ? undefined : previousType,
        optionKeys: updated.options.map((option) => option.key),
      },
    );
    return updated;
  }

  async reorder(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    dto: ReorderCustomFieldsDto,
  ) {
    await this.assertManage(actor, organizationId, projectId);
    const ids = dto.fields.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Field ids must be unique');
    }
    const owned = await this.definitions.count({
      where: ids.map((id) => ({
        id,
        organization_id: organizationId,
        project_id: projectId,
      })),
    });
    if (owned !== ids.length) {
      throw new BadRequestException('Every field must belong to the project');
    }
    await this.dataSource.transaction((manager) =>
      Promise.all(
        dto.fields.map((item) =>
          manager.getRepository(CustomFieldDefinition).update(
            {
              id: item.id,
              organization_id: organizationId,
              project_id: projectId,
            },
            { position: item.position },
          ),
        ),
      ),
    );
    await this.activities.createActivity({
      organization_id: organizationId,
      projectId,
      userId: actor.userId,
      activityType: ActivityType.PROJECT_UPDATED,
      description: 'Reordered project custom fields',
      entityType: 'custom_field_order',
      metadata: { fields: dto.fields },
    });
    return this.list(actor, organizationId, projectId);
  }

  async archive(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    fieldId: string,
  ) {
    await this.assertManage(actor, organizationId, projectId);
    const definition = await this.getDefinition(
      organizationId,
      projectId,
      fieldId,
    );
    if (!definition.archived_at) {
      definition.archived_at = new Date();
      await this.definitions.save(definition);
      await this.recordActivity(
        actor,
        organizationId,
        projectId,
        'archived',
        definition,
      );
    }
    return definition;
  }

  private assertManage(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
  ) {
    return this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
  }

  private async getDefinition(
    organizationId: string,
    projectId: number,
    fieldId: string,
  ) {
    const definition = await this.definitions.findOne({
      where: {
        id: fieldId,
        organization_id: organizationId,
        project_id: projectId,
      },
      relations: ['options'],
    });
    if (!definition) throw new NotFoundException('Custom field not found');
    return definition;
  }

  private assertOptions(
    type: CustomFieldType,
    options?: Array<{ key: string; label: string }>,
  ) {
    if (options?.length && !SELECT_TYPES.has(type)) {
      throw new BadRequestException('Only select fields may define options');
    }
    if (SELECT_TYPES.has(type) && options) {
      const keys = options.map((option) => option.key.trim().toLowerCase());
      if (new Set(keys).size !== keys.length) {
        throw new BadRequestException('Option keys must be unique');
      }
    }
  }

  private async getAuthorizedTask(
    actor: AuthUser,
    organizationId: string,
    taskId: number,
    permission: ProjectPermission,
  ) {
    const task = await this.dataSource.getRepository(Task).findOne({
      where: { id: taskId, organization_id: organizationId },
      relations: ['project', 'user', 'assignees'],
    });
    if (!task) throw new NotFoundException('Task not found');
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      task.project.id,
      permission,
    );
    if (
      permission === ProjectPermission.CONTRIBUTE &&
      !ProjectRolePolicy.canEdit(context.role)
    ) {
      const ownsTask = Number(task.user?.id) === Number(actor.userId);
      const isAssigned = task.assignees?.some(
        (assignee) => Number(assignee.id) === Number(actor.userId),
      );
      if (!ownsTask && !isAssigned) {
        throw new ForbiddenException(
          'Contributors can only change tasks they created or are assigned to',
        );
      }
    }
    return task;
  }

  private hasRequiredValue(value: unknown) {
    if (value === undefined || value === null || value === '') return false;
    return !Array.isArray(value) || value.length > 0;
  }

  private async normalizeValue(
    manager: EntityManager,
    organizationId: string,
    definition: CustomFieldDefinition,
    value: unknown,
  ): Promise<string | number | boolean | string[] | number[]> {
    const invalid = (reason: string): never => {
      throw new BadRequestException({
        message: `Invalid value for custom field ${definition.name}`,
        fieldId: definition.id,
        fieldKey: definition.key,
        reason,
      });
    };

    switch (definition.type) {
      case CustomFieldType.TEXT: {
        if (typeof value !== 'string') invalid('expected_text');
        const textValue = value as string;
        if (textValue.length > 10000) invalid('text_too_long');
        return textValue;
      }
      case CustomFieldType.NUMBER:
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          invalid('expected_finite_number');
        }
        return value as number;
      case CustomFieldType.DATE: {
        if (typeof value !== 'string') {
          invalid('expected_iso_date');
        }
        const dateValue = value as string;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          invalid('expected_iso_date');
        }
        const parsed = new Date(`${dateValue}T00:00:00.000Z`);
        if (
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== dateValue
        ) {
          invalid('invalid_calendar_date');
        }
        return dateValue;
      }
      case CustomFieldType.CHECKBOX:
        if (typeof value !== 'boolean') invalid('expected_boolean');
        return value as boolean;
      case CustomFieldType.URL: {
        if (typeof value !== 'string') invalid('expected_url');
        const normalized = (value as string).trim();
        try {
          const url = new URL(normalized);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            invalid('unsupported_url_protocol');
          }
        } catch {
          invalid('expected_absolute_http_url');
        }
        return normalized;
      }
      case CustomFieldType.SINGLE_SELECT: {
        if (typeof value !== 'string') invalid('expected_option_key');
        const allowed = new Set(
          definition.options
            .filter((option) => !option.archived_at)
            .map((option) => option.key),
        );
        const optionValue = value as string;
        if (!allowed.has(optionValue)) invalid('unknown_or_archived_option');
        return optionValue;
      }
      case CustomFieldType.MULTI_SELECT: {
        if (!Array.isArray(value)) {
          invalid('expected_option_key_array');
        }
        const optionValues = value as unknown[];
        if (optionValues.some((item) => typeof item !== 'string')) {
          invalid('expected_option_key_array');
        }
        const stringOptionValues = optionValues as string[];
        if (new Set(stringOptionValues).size !== stringOptionValues.length) {
          invalid('duplicate_options');
        }
        const allowed = new Set(
          definition.options
            .filter((option) => !option.archived_at)
            .map((option) => option.key),
        );
        if (stringOptionValues.some((option) => !allowed.has(option))) {
          invalid('unknown_or_archived_option');
        }
        return stringOptionValues;
      }
      case CustomFieldType.PERSON: {
        if (!Number.isInteger(value) || Number(value) <= 0) {
          invalid('expected_user_id');
        }
        const member = await manager.getRepository(UserOrganization).findOne({
          where: {
            organization_id: organizationId,
            user_id: Number(value),
            is_active: true,
          },
        });
        if (!member) invalid('user_is_not_an_active_organization_member');
        return Number(value);
      }
      default:
        return invalid('unsupported_field_type');
    }
  }

  private recordActivity(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    action: 'created' | 'updated' | 'archived',
    definition: CustomFieldDefinition,
    metadata: Record<string, unknown> = {},
  ) {
    return this.activities.createActivity({
      organization_id: organizationId,
      projectId,
      userId: actor.userId,
      activityType: ActivityType.PROJECT_UPDATED,
      description: `${action[0].toUpperCase()}${action.slice(
        1,
      )} custom field "${definition.name}"`,
      entityType: 'custom_field_definition',
      metadata: {
        action,
        fieldId: definition.id,
        fieldKey: definition.key,
        fieldType: definition.type,
        ...metadata,
      },
    });
  }
}
