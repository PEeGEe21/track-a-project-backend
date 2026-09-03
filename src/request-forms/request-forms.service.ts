import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes } from 'crypto';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { CustomFieldType } from 'src/custom-fields/custom-field-type';
import { CustomFieldsService } from 'src/custom-fields/custom-fields.service';
import { WorkflowVersionState } from 'src/custom-workflows/workflow-contract';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { RequestForm } from 'src/typeorm/entities/RequestForm';
import {
  RequestFormSubmission,
  RequestFormSubmissionStatus,
} from 'src/typeorm/entities/RequestFormSubmission';
import { ProjectWorkflowVersion } from 'src/typeorm/entities/ProjectWorkflowVersion';
import { Task } from 'src/typeorm/entities/Task';
import {
  RequestFormField,
  RequestFormInputType,
  RequestFormTargetType,
} from 'src/typeorm/entities/RequestFormField';
import {
  RequestFormVersion,
  RequestFormVersionState,
  RequestFormVisibility,
} from 'src/typeorm/entities/RequestFormVersion';
import { Status } from 'src/typeorm/entities/Status';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import {
  RequestFormAttachmentStatus,
  RequestFormSubmissionAttachment,
} from 'src/typeorm/entities/RequestFormSubmissionAttachment';
import { StorageService } from 'src/types/storage.interface';
import { MulterFile } from 'src/types/multer.types';
import { AuthUser } from 'src/types/users';
import { AutomationEventsService } from 'src/automations/automation-events.service';
import { ActivityType } from 'src/utils/constants/activity';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import {
  AuditAction,
  AuditActorType,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';
import {
  RequestFormConditionOperator,
  RequestFormDefinitionDto,
  RequestFormFieldDto,
  SubmitRequestFormDto,
} from './dto/request-form.dto';

const STANDARD_INPUTS: Record<string, RequestFormInputType[]> = {
  title: [RequestFormInputType.TEXT],
  description: [RequestFormInputType.TEXT, RequestFormInputType.TEXTAREA],
  due_date: [RequestFormInputType.DATE],
  priority: [RequestFormInputType.NUMBER],
  severity: [RequestFormInputType.SINGLE_SELECT],
  assignees: [RequestFormInputType.PERSON],
};
const CUSTOM_INPUTS: Record<CustomFieldType, RequestFormInputType[]> = {
  [CustomFieldType.TEXT]: [
    RequestFormInputType.TEXT,
    RequestFormInputType.TEXTAREA,
  ],
  [CustomFieldType.NUMBER]: [RequestFormInputType.NUMBER],
  [CustomFieldType.DATE]: [RequestFormInputType.DATE],
  [CustomFieldType.SINGLE_SELECT]: [RequestFormInputType.SINGLE_SELECT],
  [CustomFieldType.MULTI_SELECT]: [RequestFormInputType.MULTI_SELECT],
  [CustomFieldType.CHECKBOX]: [RequestFormInputType.CHECKBOX],
  [CustomFieldType.PERSON]: [RequestFormInputType.PERSON],
  [CustomFieldType.URL]: [RequestFormInputType.URL],
};

@Injectable()
export class RequestFormsService {
  constructor(
    @InjectRepository(RequestForm)
    private readonly forms: Repository<RequestForm>,
    private readonly dataSource: DataSource,
    private readonly authorization: AuthorizationService,
    private readonly activities: ProjectActivitiesService,
    private readonly customFields: CustomFieldsService,
    private readonly entitlements: EntitlementsService,
    private readonly config: ConfigService,
    @Inject('STORAGE_SERVICE') private readonly storage: StorageService,
    private readonly automationEvents: AutomationEventsService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  private async auditEnabled(actor: AuthUser, org: string) {
    return Boolean(
      (await this.entitlements.resolveForActor(actor, org)).find(
        (item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL,
      )?.enabled,
    );
  }

  private async auditForm(
    manager: EntityManager,
    actor: AuthUser,
    org: string,
    projectId: number,
    form: RequestForm,
    version: RequestFormVersion,
    action: AuditAction,
    status = version.state as string,
  ) {
    await this.auditWriter.append(manager, {
      organizationId: org,
      projectId,
      action,
      actor: {
        type: AuditActorType.HUMAN,
        id: actor.userId,
        label: `User ${actor.userId}`,
      },
      subject: {
        type: AuditSubjectType.REQUEST_FORM,
        id: form.id,
        label: form.name,
      },
      source: AuditSource.API,
      correlationId: this.auditWriter.correlationId(),
      after: {
        name: form.name,
        status,
        version: version.version_number,
        visibility: version.visibility,
      },
    });
  }

  async publicPublished(publicKey: string) {
    const { form, version } = await this.findPublicPublished(publicKey);
    return {
      success: true,
      data: {
        publicKey: form.public_key,
        name: form.name,
        ...this.serializeRespondentVersion(version),
      },
    };
  }

  async publicSubmit(
    publicKey: string,
    dto: SubmitRequestFormDto,
    ip?: string,
    userAgent?: string,
  ) {
    const { form } = await this.findPublicPublished(publicKey);
    if (dto.website || !dto.renderedAt || Date.now() - dto.renderedAt < 1500) {
      await this.retainPublicRejection(
        form,
        dto,
        ip,
        userAgent,
        'Automated submission signal',
      );
      throw new BadRequestException('Unable to process this request');
    }
    const actor = { userId: form.created_by_id, role: 'user' } as AuthUser;
    try {
      return await this.submit(
        actor,
        form.organization_id,
        form.project_id,
        form.id,
        dto,
        { public: true, ip, userAgent },
      );
    } catch {
      throw new BadRequestException('Unable to process this request');
    }
  }

  async addPublicAttachments(
    publicKey: string,
    submissionId: string,
    files: MulterFile[],
  ) {
    const { form } = await this.findPublicPublished(publicKey);
    const submission = await this.dataSource
      .getRepository(RequestFormSubmission)
      .findOne({
        where: {
          id: submissionId,
          form_id: form.id,
          organization_id: form.organization_id,
        },
      });
    if (
      !submission ||
      ![
        RequestFormSubmissionStatus.ACCEPTED,
        RequestFormSubmissionStatus.PENDING_REVIEW,
      ].includes(submission.status)
    )
      throw new NotFoundException('Submission not found');
    if (!files.length)
      throw new BadRequestException('At least one attachment is required');
    const allowed = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
    ]);
    if (
      files.some(
        (file) =>
          file.size <= 0 ||
          file.size > 10 * 1024 * 1024 ||
          !allowed.has(file.mimetype),
      )
    )
      throw new BadRequestException(
        'Unable to process one or more attachments',
      );
    const repo = this.dataSource.getRepository(RequestFormSubmissionAttachment);
    const existingCount = await repo.count({
      where: { submission_id: submissionId },
    });
    if (existingCount + files.length > 5)
      throw new BadRequestException('Attachment limit exceeded');
    const rows: RequestFormSubmissionAttachment[] = [];
    for (const file of files) {
      const digest = createHash('sha256').update(file.buffer).digest('hex');
      const safeName = file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-120);
      const key = `request-forms/${
        form.organization_id
      }/${submissionId}/${randomBytes(12).toString('hex')}-${safeName}`;
      await this.storage.uploadFile(file, key);
      rows.push(
        await repo.save(
          repo.create({
            submission_id: submissionId,
            original_name: safeName,
            storage_key: key,
            mime_type: file.mimetype,
            size_bytes: file.size,
            sha256: digest,
            status: RequestFormAttachmentStatus.QUARANTINED,
          }),
        ),
      );
    }
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.original_name,
        size: Number(row.size_bytes),
        status: row.status,
      })),
    };
  }

  async published(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    const form = await this.findScoped(
      this.forms.manager,
      org,
      projectId,
      formId,
    );
    const version = form.versions.find(
      (item) => item.state === RequestFormVersionState.PUBLISHED,
    );
    if (!version || form.archived_at)
      throw new NotFoundException('Published request form not found');
    return {
      success: true,
      data: {
        formId: form.id,
        name: form.name,
        ...this.serializeVersion(version),
      },
    };
  }

  async submissions(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    await this.findScoped(this.forms.manager, org, projectId, formId);
    const rows = await this.dataSource
      .getRepository(RequestFormSubmission)
      .find({
        where: { organization_id: org, project_id: projectId, form_id: formId },
        relations: ['task', 'version', 'attachments'],
        order: { created_at: 'DESC' },
        take: 100,
      });
    return {
      success: true,
      data: rows.map((row) => this.serializeSubmission(row)),
    };
  }

  async submit(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
    dto: SubmitRequestFormDto,
    context?: {
      public: boolean;
      approval?: boolean;
      ip?: string;
      userAgent?: string;
    },
  ) {
    if (!context?.public)
      await this.authorization.assertProjectPermission(
        actor,
        org,
        projectId,
        ProjectPermission.CONTRIBUTE,
      );
    const auditEnabled = Boolean(
      (context?.public
        ? await this.entitlements.resolveOrganization(org)
        : await this.entitlements.resolveForActor(actor, org)
      ).find((item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL)
        ?.enabled,
    );
    const repo = this.dataSource.getRepository(RequestFormSubmission);
    const existing = await repo.findOne({
      where: { id: dto.submissionId },
      relations: ['task', 'version'],
    });
    if (existing) {
      if (
        existing.organization_id !== org ||
        existing.project_id !== projectId ||
        existing.form_id !== formId ||
        JSON.stringify(existing.answers_snapshot) !==
          JSON.stringify(dto.answers)
      )
        throw new BadRequestException('Submission id has already been used');
      if (
        existing.status === RequestFormSubmissionStatus.ACCEPTED ||
        existing.status === RequestFormSubmissionStatus.REJECTED ||
        (existing.status === RequestFormSubmissionStatus.PENDING_REVIEW &&
          !context?.approval)
      )
        return {
          success: existing.status === RequestFormSubmissionStatus.ACCEPTED,
          idempotent: true,
          data: this.serializeSubmission(existing),
        };
    }
    let version: RequestFormVersion;
    let submission: RequestFormSubmission;
    if (existing) {
      const originalVersion = await this.loadVersion(existing.version_id);
      if (!originalVersion)
        throw new NotFoundException('Submission form version not found');
      version = originalVersion;
      submission = existing;
    } else {
      const form = await this.findScoped(
        this.forms.manager,
        org,
        projectId,
        formId,
      );
      const published = form.versions.find(
        (item) => item.state === RequestFormVersionState.PUBLISHED,
      );
      if (!published || form.archived_at)
        throw new NotFoundException('Published request form not found');
      version = published;
      submission = await repo.save(
        repo.create({
          id: dto.submissionId,
          organization_id: org,
          project_id: projectId,
          form_id: formId,
          version_id: published.id,
          submitted_by_id: context?.public ? null : actor.userId,
          submitter_email: dto.submitterEmail?.trim() || null,
          status: RequestFormSubmissionStatus.RECEIVED,
          answers_snapshot: dto.answers,
          validation_snapshot: null,
          failure_reason: null,
          source_ip_hash: context?.public ? this.hashIp(context.ip) : null,
          user_agent: context?.public
            ? context.userAgent?.slice(0, 255) || null
            : null,
        }),
      );
    }
    const validation = this.validateAnswers(version.fields, dto.answers);
    if (!validation.valid) {
      await this.dataSource.transaction(async (manager) => {
        const locked = await manager
          .getRepository(RequestFormSubmission)
          .findOne({
            where: { id: submission.id },
            lock: { mode: 'pessimistic_write' },
          });
        if (!locked) throw new Error('Submission record missing');
        locked.status = RequestFormSubmissionStatus.REJECTED;
        locked.validation_snapshot = validation;
        locked.failure_reason = 'Submission validation failed';
        await manager.getRepository(RequestFormSubmission).save(locked);
        if (auditEnabled)
          await this.auditWriter.append(manager, {
            organizationId: org,
            projectId,
            action: AuditAction.REQUEST_SUBMISSION_CREATED,
            actor: context?.public
              ? {
                  type: AuditActorType.SYSTEM,
                  id: 'public_request_intake',
                  label: 'Public request intake',
                }
              : {
                  type: AuditActorType.HUMAN,
                  id: actor.userId,
                  label: `User ${actor.userId}`,
                },
            subject: {
              type: AuditSubjectType.REQUEST_SUBMISSION,
              id: locked.id,
              label: 'Request submission',
            },
            source: AuditSource.API,
            correlationId: this.auditWriter.correlationId(),
            sourceEventKey: `request-submission:${locked.id}:rejected`,
            after: {
              status: locked.status,
              form_id: formId,
              created_task_id: null,
            },
          });
      });
      throw new BadRequestException({
        message: 'Submission validation failed',
        submissionId: submission.id,
        errors: validation.errors,
      });
    }
    if (version.requires_approval && !context?.approval) {
      await this.dataSource.transaction(async (manager) => {
        const locked = await manager
          .getRepository(RequestFormSubmission)
          .findOne({
            where: { id: submission.id },
            lock: { mode: 'pessimistic_write' },
          });
        if (!locked) throw new Error('Submission record missing');
        locked.status = RequestFormSubmissionStatus.PENDING_REVIEW;
        locked.validation_snapshot = validation;
        locked.failure_reason = null;
        await manager.getRepository(RequestFormSubmission).save(locked);
        submission = locked;
        if (auditEnabled)
          await this.auditWriter.append(manager, {
            organizationId: org,
            projectId,
            action: AuditAction.REQUEST_SUBMISSION_CREATED,
            actor: context?.public
              ? {
                  type: AuditActorType.SYSTEM,
                  id: 'public_request_intake',
                  label: 'Public request intake',
                }
              : {
                  type: AuditActorType.HUMAN,
                  id: actor.userId,
                  label: `User ${actor.userId}`,
                },
            subject: {
              type: AuditSubjectType.REQUEST_SUBMISSION,
              id: locked.id,
              label: 'Request submission',
            },
            source: AuditSource.API,
            correlationId: this.auditWriter.correlationId(),
            sourceEventKey: `request-submission:${locked.id}:pending_review`,
            after: {
              status: locked.status,
              form_id: formId,
              created_task_id: null,
            },
          });
      });
      return {
        success: true,
        idempotent: false,
        message: version.confirmation_text || 'Request submitted for approval',
        data: this.serializeSubmission(submission),
      };
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        const locked = await manager
          .getRepository(RequestFormSubmission)
          .findOne({
            where: { id: submission.id },
            lock: { mode: 'pessimistic_write' },
          });
        if (!locked) throw new Error('Submission record missing');
        if (
          locked.status === RequestFormSubmissionStatus.ACCEPTED &&
          locked.task_id
        )
          return;
        locked.status = RequestFormSubmissionStatus.RECEIVED;
        locked.failure_reason = null;
        await this.assertInitialDestination(
          manager,
          org,
          projectId,
          version.destination_status_id,
        );
        const standard = new Map<string, unknown>();
        const custom: { fieldId: string; value: any }[] = [];
        for (const field of version.fields) {
          if (
            !validation.activeKeys.includes(field.key) ||
            !(field.key in validation.normalized)
          )
            continue;
          const value = validation.normalized[field.key];
          if (field.target_type === RequestFormTargetType.STANDARD)
            standard.set(field.standard_field!, value);
          if (field.target_type === RequestFormTargetType.CUSTOM_FIELD)
            custom.push({ fieldId: field.custom_field_id!, value });
        }
        await this.assertActiveOrganizationUsers(
          manager,
          org,
          (standard.get('assignees') as number[] | undefined) ?? [],
        );
        const taskRepo = manager.getRepository(Task);
        const task = taskRepo.create({
          title: String(standard.get('title')),
          description: (standard.get('description') as string) ?? '',
          description_html: null,
          due_date: standard.has('due_date')
            ? new Date(String(standard.get('due_date')))
            : null,
          priority: (standard.get('priority') as number) ?? 0,
          severity: (standard.get('severity') as string) ?? null,
          organization_id: org,
          project: { id: projectId } as any,
          status: { id: version.destination_status_id } as Status,
          user: { id: actor.userId } as User,
          assignees: (
            (standard.get('assignees') as number[] | undefined) ?? []
          ).map((id) => ({ id }) as User),
        });
        const savedTask = await taskRepo.save(task);
        await this.customFields.setTaskValuesInTransaction(
          manager,
          org,
          projectId,
          savedTask.id,
          custom,
          true,
        );
        locked.task_id = savedTask.id;
        locked.status = RequestFormSubmissionStatus.ACCEPTED;
        locked.validation_snapshot = validation;
        locked.failure_reason = null;
        await manager.getRepository(RequestFormSubmission).save(locked);
        await this.automationEvents.capture(manager, {
          organizationId: org,
          projectId,
          eventType: 'form.submitted',
          subjectType: 'request_form_submission',
          subjectId: locked.id,
          dedupeKey: `form-submitted:${locked.id}`,
          after: {
            formId,
            formVersionId: version.id,
            submissionId: locked.id,
            taskId: savedTask.id,
          },
          actorType: context?.public ? 'integration' : 'human',
          actorId: context?.public ? null : actor.userId,
        });
        if (auditEnabled)
          await this.auditWriter.append(manager, {
            organizationId: org,
            projectId,
            action: AuditAction.REQUEST_SUBMISSION_CREATED,
            actor: context?.public
              ? {
                  type: AuditActorType.SYSTEM,
                  id: 'public_request_intake',
                  label: 'Public request intake',
                }
              : {
                  type: AuditActorType.HUMAN,
                  id: actor.userId,
                  label: `User ${actor.userId}`,
                },
            subject: {
              type: AuditSubjectType.REQUEST_SUBMISSION,
              id: locked.id,
              label: 'Request submission',
            },
            source: AuditSource.API,
            correlationId: this.auditWriter.correlationId(),
            sourceEventKey: `request-submission:${locked.id}:accepted`,
            after: {
              status: locked.status,
              form_id: formId,
              created_task_id: savedTask.id,
            },
          });
      });
    } catch (error) {
      submission = (await repo.findOneBy({ id: submission.id }))!;
      submission.status = RequestFormSubmissionStatus.FAILED;
      submission.validation_snapshot = validation;
      submission.failure_reason =
        error instanceof Error
          ? error.message.slice(0, 2000)
          : 'Task creation failed';
      await repo.save(submission);
      throw error;
    }
    submission = (await repo.findOne({
      where: { id: submission.id },
      relations: ['task', 'version'],
    }))!;
    return {
      success: true,
      idempotent: false,
      message: version.confirmation_text || 'Request submitted',
      data: this.serializeSubmission(submission),
    };
  }

  async approveSubmission(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
    submissionId: string,
    note?: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const repo = this.dataSource.getRepository(RequestFormSubmission);
    const submission = await repo.findOne({
      where: {
        id: submissionId,
        organization_id: org,
        project_id: projectId,
        form_id: formId,
      },
      relations: ['version'],
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.status !== RequestFormSubmissionStatus.PENDING_REVIEW)
      throw new BadRequestException('Only pending submissions can be approved');
    const result = await this.submit(
      actor,
      org,
      projectId,
      formId,
      {
        submissionId,
        answers: submission.answers_snapshot as Record<string, unknown>,
        submitterEmail: submission.submitter_email ?? undefined,
      },
      { public: false, approval: true },
    );
    const reviewed = await repo.findOneByOrFail({ id: submissionId });
    reviewed.reviewed_by_id = actor.userId;
    reviewed.reviewed_at = new Date();
    reviewed.review_note = note?.trim() || null;
    await repo.save(reviewed);
    return result;
  }

  async rejectSubmission(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
    submissionId: string,
    note?: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const repo = this.dataSource.getRepository(RequestFormSubmission);
    const submission = await repo.findOneBy({
      id: submissionId,
      organization_id: org,
      project_id: projectId,
      form_id: formId,
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.status !== RequestFormSubmissionStatus.PENDING_REVIEW)
      throw new BadRequestException('Only pending submissions can be rejected');
    submission.status = RequestFormSubmissionStatus.REJECTED;
    submission.reviewed_by_id = actor.userId;
    submission.reviewed_at = new Date();
    submission.review_note = note?.trim() || null;
    submission.failure_reason = 'Rejected during review';
    await repo.save(submission);
    return {
      success: true,
      message: 'Request rejected',
      data: this.serializeSubmission(submission),
    };
  }

  async list(actor: AuthUser, org: string, projectId: number) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    const forms = await this.forms.find({
      where: {
        organization_id: org,
        project_id: projectId,
        archived_at: IsNull(),
      },
      relations: this.relations(),
      order: { created_at: 'DESC' },
    });
    return { success: true, data: forms.map((form) => this.serialize(form)) };
  }

  async get(actor: AuthUser, org: string, projectId: number, formId: string) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    return {
      success: true,
      data: this.serialize(
        await this.findScoped(this.forms.manager, org, projectId, formId),
      ),
    };
  }

  async create(
    actor: AuthUser,
    org: string,
    projectId: number,
    dto: RequestFormDefinitionDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const normalized = await this.validateDefinition(org, projectId, dto);
    const auditEnabled = await this.auditEnabled(actor, org);
    const formId = await this.dataSource.transaction(async (manager) => {
      const formRepo = manager.getRepository(RequestForm);
      const form = await formRepo.save(
        formRepo.create({
          organization_id: org,
          project_id: projectId,
          public_key: randomBytes(24).toString('hex'),
          name: dto.name.trim(),
          created_by_id: actor.userId,
        }),
      );
      const versionRepo = manager.getRepository(RequestFormVersion);
      const draft = await versionRepo.save(
        versionRepo.create({
          form_id: form.id,
          version_number: 1,
          state: RequestFormVersionState.DRAFT,
          ...this.versionContent(dto),
          created_by_id: actor.userId,
        }),
      );
      await this.replaceFields(manager, draft.id, normalized);
      if (auditEnabled)
        await this.auditForm(
          manager,
          actor,
          org,
          projectId,
          form,
          draft,
          AuditAction.REQUEST_FORM_CREATED,
        );
      return form.id;
    });
    const form = await this.findScoped(
      this.forms.manager,
      org,
      projectId,
      formId,
    );
    await this.activity(actor, org, projectId, 'created', form);
    return {
      success: true,
      message: 'Request form created',
      data: this.serialize(form),
    };
  }

  async createDraft(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const draftId = await this.dataSource.transaction(async (manager) => {
      const form = await this.findScoped(manager, org, projectId, formId, true);
      if (form.archived_at)
        throw new BadRequestException('Archived forms cannot be edited');
      const existing = form.versions.find(
        (version) => version.state === RequestFormVersionState.DRAFT,
      );
      if (existing) return existing.id;
      const published = form.versions.find(
        (version) => version.state === RequestFormVersionState.PUBLISHED,
      );
      if (!published)
        throw new BadRequestException('Published form version missing');
      const repo = manager.getRepository(RequestFormVersion);
      const draft = await repo.save(
        repo.create({
          form_id: form.id,
          version_number:
            Math.max(
              ...form.versions.map((version) => version.version_number),
            ) + 1,
          state: RequestFormVersionState.DRAFT,
          title: published.title,
          description: published.description,
          visibility: published.visibility,
          destination_status_id: published.destination_status_id,
          confirmation_text: published.confirmation_text,
          requires_approval: published.requires_approval,
          created_by_id: actor.userId,
        }),
      );
      await this.replaceFields(
        manager,
        draft.id,
        published.fields.map((field) => this.fieldToDto(field)),
      );
      return draft.id;
    });
    return {
      success: true,
      data: this.serializeVersion(await this.loadVersion(draftId)),
    };
  }

  async updateDraft(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
    dto: RequestFormDefinitionDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const normalized = await this.validateDefinition(org, projectId, dto);
    const auditEnabled = await this.auditEnabled(actor, org);
    await this.dataSource.transaction(async (manager) => {
      const form = await this.findScoped(manager, org, projectId, formId, true);
      if (form.archived_at)
        throw new BadRequestException('Archived forms cannot be edited');
      const draft = form.versions.find(
        (version) => version.state === RequestFormVersionState.DRAFT,
      );
      if (!draft) throw new BadRequestException('Create a form draft first');
      form.name = dto.name.trim();
      await manager.getRepository(RequestForm).save(form);
      Object.assign(draft, this.versionContent(dto));
      await manager.getRepository(RequestFormVersion).save(draft);
      await this.replaceFields(manager, draft.id, normalized);
      if (auditEnabled)
        await this.auditForm(
          manager,
          actor,
          org,
          projectId,
          form,
          draft,
          AuditAction.REQUEST_FORM_UPDATED,
        );
    });
    const form = await this.findScoped(
      this.forms.manager,
      org,
      projectId,
      formId,
    );
    await this.activity(actor, org, projectId, 'draft_updated', form);
    return {
      success: true,
      message: 'Request form draft updated',
      data: this.serialize(form),
    };
  }

  async preview(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
    dto: RequestFormDefinitionDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    await this.findScoped(this.forms.manager, org, projectId, formId);
    const fields = await this.validateDefinition(org, projectId, dto);
    return {
      success: true,
      data: { ...this.versionContent(dto), fields, valid: true },
    };
  }

  async publish(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.MANAGE_SETTINGS,
    );
    if (context.role !== ProjectRole.OWNER && actor.role !== 'super_admin')
      throw new ForbiddenException(
        'Only project owners can publish request forms',
      );
    const auditEnabled = await this.auditEnabled(actor, org);
    await this.dataSource.transaction(async (manager) => {
      const form = await this.findScoped(manager, org, projectId, formId, true);
      if (form.archived_at)
        throw new BadRequestException('Archived forms cannot be published');
      const draft = form.versions.find(
        (version) => version.state === RequestFormVersionState.DRAFT,
      );
      if (!draft) throw new BadRequestException('Request form draft not found');
      await this.validateDefinition(
        org,
        projectId,
        this.versionToDto(form, draft),
      );
      const published = form.versions.find(
        (version) => version.state === RequestFormVersionState.PUBLISHED,
      );
      if (published) {
        published.state = RequestFormVersionState.RETIRED;
        await manager.getRepository(RequestFormVersion).save(published);
      }
      draft.state = RequestFormVersionState.PUBLISHED;
      draft.published_by = { id: actor.userId } as User;
      draft.published_at = new Date();
      await manager.getRepository(RequestFormVersion).save(draft);
      if (auditEnabled)
        await this.auditForm(
          manager,
          actor,
          org,
          projectId,
          form,
          draft,
          AuditAction.REQUEST_FORM_PUBLISHED,
        );
    });
    const form = await this.findScoped(
      this.forms.manager,
      org,
      projectId,
      formId,
    );
    await this.activity(actor, org, projectId, 'published', form);
    return {
      success: true,
      message: 'Request form published',
      data: this.serialize(form),
    };
  }

  async archive(
    actor: AuthUser,
    org: string,
    projectId: number,
    formId: string,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.MANAGE_SETTINGS,
    );
    if (context.role !== ProjectRole.OWNER && actor.role !== 'super_admin')
      throw new ForbiddenException(
        'Only project owners can archive request forms',
      );
    const auditEnabled = await this.auditEnabled(actor, org);
    const archived = await this.dataSource.transaction(async (manager) => {
      const form = await this.findScoped(manager, org, projectId, formId, true);
      if (form.archived_at) return null;
      form.archived_at = new Date();
      await manager.getRepository(RequestForm).save(form);
      const version =
        form.versions.find(
          (item) => item.state === RequestFormVersionState.PUBLISHED,
        ) ?? form.versions[0];
      if (auditEnabled && version)
        await this.auditForm(
          manager,
          actor,
          org,
          projectId,
          form,
          version,
          AuditAction.REQUEST_FORM_ARCHIVED,
          'archived',
        );
      return form;
    });
    if (archived) {
      await this.activity(actor, org, projectId, 'archived', archived);
    }
    return { success: true, message: 'Request form archived' };
  }

  private async validateDefinition(
    org: string,
    projectId: number,
    dto: RequestFormDefinitionDto,
  ) {
    const status = await this.dataSource.getRepository(Status).findOne({
      where: { id: dto.destinationStatusId, project: { id: projectId } },
    });
    if (!status)
      throw new BadRequestException(
        'Destination status does not belong to this project',
      );
    const keys = dto.fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length)
      throw new BadRequestException('Form field keys must be unique');
    const positions = dto.fields.map((field) => field.position);
    if (new Set(positions).size !== positions.length)
      throw new BadRequestException('Form field positions must be unique');
    const titles = dto.fields.filter(
      (field) =>
        field.targetType === RequestFormTargetType.STANDARD &&
        field.standardField === 'title',
    );
    if (titles.length !== 1 || !titles[0].required)
      throw new BadRequestException(
        'Form must contain exactly one required task title field',
      );
    if (
      dto.visibility === RequestFormVisibility.PUBLIC &&
      dto.fields.some(
        (field) => field.inputType === RequestFormInputType.PERSON,
      )
    )
      throw new BadRequestException(
        'Public forms cannot expose organization person fields',
      );

    const customIds = dto.fields
      .filter(
        (field) => field.targetType === RequestFormTargetType.CUSTOM_FIELD,
      )
      .map((field) => field.customFieldId)
      .filter(Boolean) as string[];
    const custom = customIds.length
      ? await this.dataSource.getRepository(CustomFieldDefinition).find({
          where: {
            id: In(customIds),
            organization_id: org,
            project_id: projectId,
            archived_at: IsNull(),
          },
          relations: ['options'],
        })
      : [];
    if (custom.length !== new Set(customIds).size)
      throw new BadRequestException('A mapped custom field is unavailable');
    const customById = new Map(
      custom.map((definition) => [definition.id, definition]),
    );
    const ordered = [...dto.fields].sort((a, b) => a.position - b.position);
    const prior = new Set<string>();
    for (const field of ordered) {
      this.validateMapping(field, customById);
      for (const condition of field.conditions ?? []) {
        if (!prior.has(condition.fieldKey))
          throw new BadRequestException(
            `Condition for ${field.key} must reference an earlier field`,
          );
        if (
          [
            RequestFormConditionOperator.IS_SET,
            RequestFormConditionOperator.IS_NOT_SET,
          ].includes(condition.operator) &&
          condition.value !== undefined
        )
          throw new BadRequestException(
            `Condition ${condition.operator} must not include a value`,
          );
      }
      prior.add(field.key);
    }
    return ordered.map((field) => {
      const definition = field.customFieldId
        ? customById.get(field.customFieldId)
        : null;
      const options =
        definition &&
        [CustomFieldType.SINGLE_SELECT, CustomFieldType.MULTI_SELECT].includes(
          definition.type,
        )
          ? definition.options
              .filter((option) => !option.archived_at)
              .sort((a, b) => a.position - b.position)
              .map((option) => ({ key: option.key, label: option.label }))
          : field.options ?? null;
      return { ...field, options };
    });
  }

  private validateMapping(
    field: RequestFormFieldDto,
    custom: Map<string, CustomFieldDefinition>,
  ) {
    if (field.targetType === RequestFormTargetType.STANDARD) {
      if (
        !field.standardField ||
        field.customFieldId ||
        !STANDARD_INPUTS[field.standardField]?.includes(field.inputType)
      )
        throw new BadRequestException(
          `Invalid standard mapping for ${field.key}`,
        );
    } else if (field.targetType === RequestFormTargetType.CUSTOM_FIELD) {
      const definition = field.customFieldId
        ? custom.get(field.customFieldId)
        : null;
      if (
        !definition ||
        field.standardField ||
        !CUSTOM_INPUTS[definition.type].includes(field.inputType)
      )
        throw new BadRequestException(
          `Invalid custom field mapping for ${field.key}`,
        );
    } else if (field.standardField || field.customFieldId) {
      throw new BadRequestException(
        `Submission-only field ${field.key} cannot have a task mapping`,
      );
    }
    if (
      [
        RequestFormInputType.SINGLE_SELECT,
        RequestFormInputType.MULTI_SELECT,
      ].includes(field.inputType) &&
      field.targetType !== RequestFormTargetType.CUSTOM_FIELD &&
      !field.options?.length
    )
      throw new BadRequestException(
        `Select field ${field.key} requires options`,
      );
    if (
      field.inputType === RequestFormInputType.FILE &&
      field.targetType !== RequestFormTargetType.SUBMISSION_ONLY
    )
      throw new BadRequestException('File fields must be submission-only');
  }

  private async replaceFields(
    manager: EntityManager,
    versionId: string,
    fields: RequestFormFieldDto[],
  ) {
    const repo = manager.getRepository(RequestFormField);
    await repo.delete({ version_id: versionId });
    await repo.save(
      fields.map((field) =>
        repo.create({
          version_id: versionId,
          key: field.key,
          label: field.label.trim(),
          description: field.description?.trim() || null,
          input_type: field.inputType,
          target_type: field.targetType,
          standard_field: field.standardField ?? null,
          custom_field_id: field.customFieldId ?? null,
          required: field.required,
          position: field.position,
          options_snapshot: field.options ?? null,
          conditions: field.conditions ?? null,
          config: field.config ?? null,
        }),
      ),
    );
  }

  private validateAnswers(
    fields: RequestFormField[],
    answers: Record<string, unknown>,
  ) {
    const errors: { field: string; code: string }[] = [];
    const normalized: Record<string, any> = {};
    const activeKeys: string[] = [];
    const known = new Set(fields.map((field) => field.key));
    for (const key of Object.keys(answers)) {
      if (!known.has(key)) errors.push({ field: key, code: 'unknown_field' });
    }
    for (const field of [...fields].sort((a, b) => a.position - b.position)) {
      const active = ((field.conditions as any[]) ?? []).every((condition) =>
        this.conditionMatches(normalized[condition.fieldKey], condition),
      );
      if (!active) continue;
      activeKeys.push(field.key);
      const raw = answers[field.key];
      if (raw === undefined || raw === null || raw === '') {
        if (field.required) errors.push({ field: field.key, code: 'required' });
        continue;
      }
      try {
        normalized[field.key] = this.normalizeAnswer(field, raw);
      } catch {
        errors.push({ field: field.key, code: 'invalid_type' });
      }
    }
    return { valid: errors.length === 0, errors, activeKeys, normalized };
  }

  private normalizeAnswer(field: RequestFormField, value: unknown) {
    const options = new Set(
      ((field.options_snapshot as any[]) ?? []).map((item) => item.key),
    );
    switch (field.input_type) {
      case RequestFormInputType.TEXT:
      case RequestFormInputType.TEXTAREA:
        if (typeof value !== 'string' || !value.trim()) throw new Error();
        return value.trim();
      case RequestFormInputType.EMAIL:
        if (
          typeof value !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        )
          throw new Error();
        return value.trim().toLowerCase();
      case RequestFormInputType.URL:
        if (typeof value !== 'string') throw new Error();
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        return url.toString();
      case RequestFormInputType.NUMBER:
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw new Error();
        return value;
      case RequestFormInputType.CHECKBOX:
        if (typeof value !== 'boolean') throw new Error();
        return value;
      case RequestFormInputType.DATE:
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
          throw new Error();
        const parsed = new Date(`${value}T00:00:00.000Z`);
        if (
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== value
        )
          throw new Error();
        return value;
      case RequestFormInputType.SINGLE_SELECT:
        if (typeof value !== 'string' || !options.has(value)) throw new Error();
        return value;
      case RequestFormInputType.MULTI_SELECT:
        if (
          !Array.isArray(value) ||
          value.some(
            (item) => typeof item !== 'string' || !options.has(item),
          ) ||
          new Set(value).size !== value.length
        )
          throw new Error();
        return value;
      case RequestFormInputType.PERSON:
        if (field.target_type === RequestFormTargetType.CUSTOM_FIELD) {
          if (!Number.isInteger(value) || Number(value) <= 0) throw new Error();
          return Number(value);
        }
        if (
          !Array.isArray(value) ||
          value.some((item) => !Number.isInteger(item) || Number(item) <= 0) ||
          new Set(value).size !== value.length
        )
          throw new Error();
        return value.map(Number);
      case RequestFormInputType.FILE:
        if (
          !Array.isArray(value) ||
          !value.length ||
          value.length > 5 ||
          value.some((item) => typeof item !== 'string' || item.length > 255)
        )
          throw new Error();
        return value;
    }
  }

  private conditionMatches(value: unknown, condition: any) {
    const isSet =
      value !== undefined &&
      value !== null &&
      value !== '' &&
      (!Array.isArray(value) || value.length > 0);
    switch (condition.operator) {
      case RequestFormConditionOperator.IS_SET:
        return isSet;
      case RequestFormConditionOperator.IS_NOT_SET:
        return !isSet;
      case RequestFormConditionOperator.EQUALS:
        return JSON.stringify(value) === JSON.stringify(condition.value);
      case RequestFormConditionOperator.NOT_EQUALS:
        return JSON.stringify(value) !== JSON.stringify(condition.value);
      case RequestFormConditionOperator.CONTAINS:
        return Array.isArray(value)
          ? value.includes(condition.value)
          : typeof value === 'string' &&
              value.includes(String(condition.value));
      default:
        return false;
    }
  }

  private async assertInitialDestination(
    manager: EntityManager,
    org: string,
    projectId: number,
    statusId: number,
  ) {
    const version = await manager
      .getRepository(ProjectWorkflowVersion)
      .createQueryBuilder('version')
      .innerJoin('version.workflow', 'workflow')
      .innerJoinAndSelect('version.statuses', 'workflowStatus')
      .innerJoinAndSelect('workflowStatus.status', 'status')
      .where('workflow.organization_id = :org', { org })
      .andWhere('workflow.project_id = :projectId', { projectId })
      .andWhere('version.state = :state', {
        state: WorkflowVersionState.PUBLISHED,
      })
      .getOne();
    const initial = version?.statuses.find((item) => item.is_initial);
    if (!initial || initial.status.id !== statusId)
      throw new BadRequestException(
        'Form destination is not the published workflow initial status',
      );
  }

  private async assertActiveOrganizationUsers(
    manager: EntityManager,
    org: string,
    userIds: number[],
  ) {
    if (!userIds.length) return;
    const count = await manager.getRepository(UserOrganization).count({
      where: { organization_id: org, user_id: In(userIds), is_active: true },
    });
    if (count !== new Set(userIds).size)
      throw new BadRequestException(
        'Assignees must be active organization members',
      );
  }

  private async findPublicPublished(publicKey: string) {
    const form = await this.forms.findOne({
      where: { public_key: publicKey, archived_at: IsNull() },
      relations: this.relations(),
    });
    const version = form?.versions.find(
      (item) =>
        item.state === RequestFormVersionState.PUBLISHED &&
        item.visibility === RequestFormVisibility.PUBLIC,
    );
    if (!form || !version)
      throw new NotFoundException('Request form not found');
    const resolved = await this.entitlements.resolveOrganization(
      form.organization_id,
    );
    if (
      !resolved.find((item) => item.key === CapabilityKey.REQUEST_FORMS)
        ?.enabled
    )
      throw new NotFoundException('Request form not found');
    return { form, version };
  }

  private async retainPublicRejection(
    form: RequestForm,
    dto: SubmitRequestFormDto,
    ip: string | undefined,
    userAgent: string | undefined,
    reason: string,
  ) {
    const version = form.versions.find(
      (item) => item.state === RequestFormVersionState.PUBLISHED,
    )!;
    const repo = this.dataSource.getRepository(RequestFormSubmission);
    const existing = await repo.findOneBy({ id: dto.submissionId });
    if (existing) return;
    await repo.save(
      repo.create({
        id: dto.submissionId,
        organization_id: form.organization_id,
        project_id: form.project_id,
        form_id: form.id,
        version_id: version.id,
        task_id: null,
        submitted_by_id: null,
        submitter_email: dto.submitterEmail?.trim() || null,
        status: RequestFormSubmissionStatus.REJECTED,
        answers_snapshot: dto.answers,
        validation_snapshot: {
          valid: false,
          errors: [{ code: 'spam_signal' }],
        },
        source_ip_hash: this.hashIp(ip),
        user_agent: userAgent?.slice(0, 255) || null,
        failure_reason: reason,
      }),
    );
  }

  private hashIp(ip?: string) {
    if (!ip) return null;
    const secret =
      this.config.get<string>('REQUEST_FORM_IP_HASH_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      'request-form-ip';
    return createHmac('sha256', secret).update(ip).digest('hex');
  }

  private serializeSubmission(row: RequestFormSubmission) {
    return {
      id: row.id,
      status: row.status,
      version: row.version?.version_number,
      taskId: row.task_id,
      answers: row.answers_snapshot,
      validation: row.validation_snapshot,
      failureReason: row.failure_reason,
      reviewedById: row.reviewed_by_id,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      attachments: (row.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        name: attachment.original_name,
        mimeType: attachment.mime_type,
        size: Number(attachment.size_bytes),
        status: attachment.status,
      })),
      createdAt: row.created_at,
    };
  }

  private serializeRespondentVersion(version: RequestFormVersion) {
    return {
      version: version.version_number,
      title: version.title,
      description: version.description,
      confirmationText: version.confirmation_text,
      requiresApproval: version.requires_approval,
      fields: [...(version.fields ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((field) => ({
          key: field.key,
          label: field.label,
          description: field.description,
          inputType: field.input_type,
          required: field.required,
          position: field.position,
          options: field.options_snapshot,
          conditions: field.conditions,
          config: field.config,
        })),
    };
  }

  private versionContent(dto: RequestFormDefinitionDto) {
    return {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      visibility: dto.visibility,
      destination_status_id: dto.destinationStatusId,
      confirmation_text: dto.confirmationText?.trim() || null,
      requires_approval: dto.requiresApproval ?? false,
    };
  }

  private async findScoped(
    manager: EntityManager,
    org: string,
    projectId: number,
    formId: string,
    lock = false,
  ) {
    const form = await manager.getRepository(RequestForm).findOne({
      where: { id: formId, organization_id: org, project_id: projectId },
      relations: this.relations(),
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!form) throw new NotFoundException('Request form not found');
    return form;
  }

  private loadVersion(id: string) {
    return this.dataSource.getRepository(RequestFormVersion).findOne({
      where: { id },
      relations: ['destination_status', 'fields', 'fields.custom_field'],
    });
  }

  private relations() {
    return [
      'versions',
      'versions.destination_status',
      'versions.fields',
      'versions.fields.custom_field',
    ];
  }

  private serialize(form: RequestForm) {
    const versions = [...(form.versions ?? [])].sort(
      (a, b) => b.version_number - a.version_number,
    );
    return {
      id: form.id,
      name: form.name,
      publicKey: form.public_key,
      archivedAt: form.archived_at,
      published: this.serializeVersion(
        versions.find(
          (version) => version.state === RequestFormVersionState.PUBLISHED,
        ),
      ),
      draft: this.serializeVersion(
        versions.find(
          (version) => version.state === RequestFormVersionState.DRAFT,
        ),
      ),
      createdAt: form.created_at,
      updatedAt: form.updated_at,
    };
  }

  private serializeVersion(version?: RequestFormVersion | null) {
    if (!version) return null;
    return {
      id: version.id,
      version: version.version_number,
      state: version.state,
      title: version.title,
      description: version.description,
      visibility: version.visibility,
      destinationStatus: version.destination_status
        ? {
            id: version.destination_status.id,
            title: version.destination_status.title,
          }
        : { id: version.destination_status_id },
      confirmationText: version.confirmation_text,
      requiresApproval: version.requires_approval,
      publishedAt: version.published_at,
      fields: [...(version.fields ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          description: field.description,
          inputType: field.input_type,
          targetType: field.target_type,
          standardField: field.standard_field,
          customFieldId: field.custom_field_id,
          required: field.required,
          position: field.position,
          options: field.options_snapshot,
          conditions: field.conditions,
          config: field.config,
        })),
    };
  }

  private fieldToDto(field: RequestFormField): RequestFormFieldDto {
    return {
      key: field.key,
      label: field.label,
      description: field.description ?? undefined,
      inputType: field.input_type,
      targetType: field.target_type,
      standardField: field.standard_field ?? undefined,
      customFieldId: field.custom_field_id ?? undefined,
      required: field.required,
      position: field.position,
      options: (field.options_snapshot as any) ?? undefined,
      conditions: (field.conditions as any) ?? undefined,
      config: (field.config as any) ?? undefined,
    };
  }

  private versionToDto(
    form: RequestForm,
    version: RequestFormVersion,
  ): RequestFormDefinitionDto {
    return {
      name: form.name,
      title: version.title,
      description: version.description ?? undefined,
      visibility: version.visibility,
      destinationStatusId: version.destination_status_id,
      confirmationText: version.confirmation_text ?? undefined,
      requiresApproval: version.requires_approval,
      fields: version.fields.map((field) => this.fieldToDto(field)),
    };
  }

  private activity(
    actor: AuthUser,
    org: string,
    projectId: number,
    action: string,
    form: RequestForm,
  ) {
    return this.activities.createActivity({
      organization_id: org,
      projectId,
      userId: actor.userId,
      activityType: ActivityType.PROJECT_UPDATED,
      description: `${
        action === 'created'
          ? 'Created'
          : action === 'archived'
            ? 'Archived'
            : 'Updated'
      } request form "${form.name}"`,
      entityType: 'request_form',
      metadata: {
        action,
        formId: form.id,
        formName: form.name,
        publishedVersion:
          form.versions?.find(
            (version) => version.state === RequestFormVersionState.PUBLISHED,
          )?.version_number ?? null,
      },
    });
  }
}
