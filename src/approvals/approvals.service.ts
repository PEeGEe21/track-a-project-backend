import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { ApprovalDecision } from 'src/typeorm/entities/ApprovalResponse';
import {
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalSubjectType,
} from 'src/typeorm/entities/ApprovalRequest';
import { ApprovalReviewer } from 'src/typeorm/entities/ApprovalReviewer';
import { ApprovalResponse } from 'src/typeorm/entities/ApprovalResponse';
import { Document } from 'src/typeorm/entities/Document';
import { Milestone } from 'src/typeorm/entities/Milestone';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { AuthUser } from 'src/types/users';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { randomUUID } from 'crypto';
import { DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import { CreateApprovalDto, RespondApprovalDto } from './dto/approval.dto';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import {
  AuditAction,
  AuditActorType,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';

@Injectable()
export class ApprovalsService {
  constructor(
    private dataSource: DataSource,
    private authorization: AuthorizationService,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
    private auditWriter: AuditWriterService,
  ) {}
  private async auditEnabled(actor: AuthUser, org: string) {
    return Boolean(
      (await this.entitlements.resolveForActor(actor, org)).find(
        (item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL,
      )?.enabled,
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendDueReminders() {
    const requests = await this.dataSource.getRepository(ApprovalRequest).find({
      where: {
        status: ApprovalRequestStatus.PENDING,
        due_at: LessThanOrEqual(new Date(Date.now() + 86400000)),
        reminder_sent_at: IsNull(),
      },
      relations: ['reviewers', 'responses'],
      take: 500,
    });
    for (const request of requests) {
      const responded = new Set(
        request.responses.map((item) => Number(item.reviewer_id)),
      );
      for (const reviewer of request.reviewers.filter(
        (item) => !responded.has(Number(item.reviewer_id)),
      )) {
        await this.notifications.enqueueNotification(
          {
            recipient: { id: reviewer.reviewer_id } as any,
            sender: null,
            title: 'Approval due',
            message: `Approval for ${request.subject_type} is due soon.`,
            type: NOTIFICATION_TYPES.DEADLINE_REMINDER,
            metadata: {
              approvalRequestId: request.id,
              projectId: request.project_id,
              deliveryKey: `approval:${request.id}:${reviewer.reviewer_id}`,
            },
          },
          request.organization_id,
        );
      }
      const auditEnabled = Boolean(
        (
          await this.entitlements.resolveOrganization(request.organization_id)
        ).find((item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL)
          ?.enabled,
      );
      await this.dataSource.transaction(async (manager) => {
        request.reminder_sent_at = new Date();
        await manager.getRepository(ApprovalRequest).save(request);
        if (auditEnabled)
          await this.auditWriter.append(manager, {
            organizationId: request.organization_id,
            projectId: request.project_id,
            action: AuditAction.APPROVAL_REMINDER_SENT,
            actor: {
              type: AuditActorType.SYSTEM,
              id: 'approval_reminder_scheduler',
              label: 'Approval reminder scheduler',
            },
            subject: {
              type: AuditSubjectType.APPROVAL_REQUEST,
              id: request.id,
              label: `${request.subject_type} approval`,
            },
            source: AuditSource.SCHEDULER,
            correlationId: this.auditWriter.correlationId(),
            sourceEventKey: `approval-reminder:${request.id}`,
            after: {
              status: request.status,
              subject_type: request.subject_type,
              subject_id: request.subject_id,
              reviewer_count: request.reviewers.length - responded.size,
            },
          });
      });
    }
    return requests.length;
  }
  async list(actor: AuthUser, org: string, projectId: number) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    const rows = await this.dataSource.getRepository(ApprovalRequest).find({
      where: { organization_id: org, project_id: projectId },
      relations: [
        'reviewers',
        'reviewers.reviewer',
        'responses',
        'responses.reviewer',
        'requested_by',
      ],
      order: { created_at: 'DESC' },
      take: 100,
    });
    return {
      success: true,
      data: rows.map((row) => this.serialize(row, actor.userId)),
    };
  }
  async options(actor: AuthUser, org: string, projectId: number) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    const project = await this.dataSource.getRepository(Project).findOne({
      where: { id: projectId, organization_id: org },
      relations: ['user', 'projectPeers', 'projectPeers.user'],
    });
    if (!project) throw new NotFoundException('Project not found');
    const candidateIds = [
      ...new Set(
        [
          Number(project.user?.id),
          ...(project.projectPeers ?? [])
            .filter(
              (peer) =>
                peer.status === ProjectPeerStatus.CONNECTED &&
                peer.is_confirmed,
            )
            .map((peer) => Number(peer.user?.id)),
        ].filter(Boolean),
      ),
    ];
    const memberships = candidateIds.length
      ? await this.dataSource.getRepository(UserOrganization).find({
          where: {
            organization_id: org,
            user_id: In(candidateIds),
            is_active: true,
          },
          relations: ['user'],
        })
      : [];
    const [tasks, documents, milestones] = await Promise.all([
      this.dataSource.getRepository(Task).find({
        where: { organization_id: org, project: { id: projectId } },
        order: { updated_at: 'DESC' },
        take: 500,
      }),
      this.dataSource.getRepository(Document).find({
        where: { organization_id: org, project: { id: projectId } },
        order: { updatedAt: 'DESC' },
        take: 500,
      }),
      this.dataSource.getRepository(Milestone).find({
        where: {
          organization_id: org,
          project_id: projectId,
          archived_at: IsNull(),
        },
        order: { updated_at: 'DESC' },
        take: 500,
      }),
    ]);
    return {
      success: true,
      data: {
        reviewers: memberships
          .filter(
            (membership) => Number(membership.user_id) !== Number(actor.userId),
          )
          .map((membership) => ({
            id: Number(membership.user_id),
            name:
              `${membership.user?.first_name ?? ''} ${
                membership.user?.last_name ?? ''
              }`.trim() ||
              membership.user?.email ||
              `User ${membership.user_id}`,
          })),
        subjects: {
          task: tasks.map((task) => ({
            id: String(task.id),
            title: task.title,
          })),
          document: documents.map((document) => ({
            id: document.id,
            title: document.title,
          })),
          milestone: milestones.map((milestone) => ({
            id: milestone.id,
            title: milestone.title,
          })),
        },
      },
    };
  }

  async inbox(actor: AuthUser, org: string) {
    await this.authorization.getProjectAccessScope(actor, org);
    const rows = await this.dataSource
      .getRepository(ApprovalRequest)
      .createQueryBuilder('request')
      .innerJoin(
        'request.reviewers',
        'assigned',
        'assigned.reviewer_id = :userId',
        { userId: actor.userId },
      )
      .leftJoinAndSelect('request.reviewers', 'reviewers')
      .leftJoinAndSelect('reviewers.reviewer', 'reviewer')
      .leftJoinAndSelect('request.responses', 'responses')
      .leftJoinAndSelect('responses.reviewer', 'responseReviewer')
      .leftJoinAndSelect('request.requested_by', 'requester')
      .where('request.organization_id = :org', { org })
      .orderBy('request.created_at', 'DESC')
      .take(100)
      .getMany();
    return {
      success: true,
      data: rows.map((row) => this.serialize(row, actor.userId)),
    };
  }
  async create(
    actor: AuthUser,
    org: string,
    projectId: number,
    dto: CreateApprovalDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.CONTRIBUTE,
    );
    const reviewerIds = [...new Set(dto.reviewerIds.map(Number))];
    if (reviewerIds.includes(Number(actor.userId)))
      throw new BadRequestException(
        'Requester cannot review their own approval request',
      );
    await this.assertReviewers(org, projectId, reviewerIds);
    const subject = await this.snapshot(
      org,
      projectId,
      dto.subjectType,
      dto.subjectId,
    );
    const auditEnabled = await this.auditEnabled(actor, org);
    const id = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ApprovalRequest);
      const request = await repo.save(
        repo.create({
          organization_id: org,
          project_id: projectId,
          subject_type: dto.subjectType,
          subject_id: dto.subjectId,
          subject_snapshot: subject.snapshot,
          subject_revision: subject.revision,
          status: ApprovalRequestStatus.PENDING,
          requested_by_id: actor.userId,
          message: dto.message?.trim() || null,
          due_at: dto.dueAt ? new Date(dto.dueAt) : null,
          rejection_comment_required: dto.rejectionCommentRequired ?? false,
        }),
      );
      await manager.getRepository(ApprovalReviewer).save(
        reviewerIds.map((reviewer_id) => ({
          request_id: request.id,
          reviewer_id,
        })),
      );
      if (auditEnabled)
        await this.auditWriter.append(manager, {
          organizationId: org,
          projectId,
          action: AuditAction.APPROVAL_REQUEST_CREATED,
          actor: {
            type: AuditActorType.HUMAN,
            id: actor.userId,
            label: `User ${actor.userId}`,
          },
          subject: {
            type: AuditSubjectType.APPROVAL_REQUEST,
            id: request.id,
            label: `${dto.subjectType} approval`,
          },
          source: AuditSource.API,
          correlationId: this.auditWriter.correlationId(),
          after: {
            status: request.status,
            subject_type: dto.subjectType,
            subject_id: dto.subjectId,
            reviewer_count: reviewerIds.length,
          },
        });
      return request.id;
    });
    return this.get(actor, org, projectId, id);
  }
  async get(actor: AuthUser, org: string, projectId: number, id: string) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    const row = await this.load(org, projectId, id);
    return { success: true, data: this.serialize(row, actor.userId) };
  }
  async respond(
    actor: AuthUser,
    org: string,
    projectId: number,
    id: string,
    dto: RespondApprovalDto,
  ) {
    try {
      await this.authorization.assertProjectPermission(
        actor,
        org,
        projectId,
        ProjectPermission.VIEW,
      );
      let invalidated = false;
      const auditEnabled = await this.auditEnabled(actor, org);
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(ApprovalRequest);
        const request = await repo.findOne({
          where: { id, organization_id: org, project_id: projectId },
          relations: ['reviewers', 'responses'],
          lock: { mode: 'pessimistic_write' },
        });
        if (!request) throw new NotFoundException('Approval request not found');
        if (request.status !== ApprovalRequestStatus.PENDING)
          throw new BadRequestException(
            'Approval request is no longer pending',
          );
        if (
          !request.reviewers.some(
            (item) => Number(item.reviewer_id) === Number(actor.userId),
          )
        )
          throw new ForbiddenException('Only assigned reviewers can respond');
        if (
          request.responses.some(
            (item) => Number(item.reviewer_id) === Number(actor.userId),
          )
        )
          throw new BadRequestException('Reviewer response is immutable');
        if (
          dto.decision === ApprovalDecision.REJECTED &&
          request.rejection_comment_required &&
          !dto.comment?.trim()
        )
          throw new BadRequestException('A rejection comment is required');
        const current = await this.snapshot(
          org,
          projectId,
          request.subject_type,
          request.subject_id,
        );
        if (current.revision !== request.subject_revision) {
          request.status = ApprovalRequestStatus.INVALIDATED;
          request.invalidation_reason =
            'Subject changed after approval was requested';
          request.resolved_at = new Date();
          await repo.update(
            { id: request.id, organization_id: org, project_id: projectId },
            {
              status: request.status,
              invalidation_reason: request.invalidation_reason,
              resolved_at: request.resolved_at,
            },
          );
          if (auditEnabled)
            await this.auditWriter.append(manager, {
              organizationId: org,
              projectId,
              action: AuditAction.APPROVAL_REQUEST_INVALIDATED,
              actor: {
                type: AuditActorType.HUMAN,
                id: actor.userId,
                label: `User ${actor.userId}`,
              },
              subject: {
                type: AuditSubjectType.APPROVAL_REQUEST,
                id: request.id,
                label: `${request.subject_type} approval`,
              },
              source: AuditSource.API,
              correlationId: this.auditWriter.correlationId(),
              before: { status: ApprovalRequestStatus.PENDING },
              after: { status: request.status, reason: 'subject_changed' },
            });
          invalidated = true;
          return;
        }
        // Keep this insert explicit. TypeORM can resolve the relation-owned join
        // columns to null when a response entity contains RelationId properties.
        await manager.query(
          'INSERT INTO `approval_responses` (`id`, `request_id`, `reviewer_id`, `decision`, `comment`, `subject_snapshot`) VALUES (?, ?, ?, ?, ?, ?)',
          [
            randomUUID(),
            request.id,
            actor.userId,
            dto.decision,
            dto.comment?.trim() || null,
            JSON.stringify(current.snapshot),
          ],
        );
        const responses = [
          ...request.responses,
          {
            reviewer_id: actor.userId,
            decision: dto.decision,
          } as ApprovalResponse,
        ];
        if (dto.decision === ApprovalDecision.REJECTED)
          request.status = ApprovalRequestStatus.REJECTED;
        else if (
          request.reviewers.every((reviewer) =>
            responses.some(
              (response) =>
                Number(response.reviewer_id) === Number(reviewer.reviewer_id) &&
                response.decision === ApprovalDecision.APPROVED,
            ),
          )
        )
          request.status = ApprovalRequestStatus.APPROVED;
        if (request.status !== ApprovalRequestStatus.PENDING)
          request.resolved_at = new Date();
        await repo.update(
          { id: request.id, organization_id: org, project_id: projectId },
          {
            status: request.status,
            resolved_at: request.resolved_at,
          },
        );
        if (auditEnabled)
          await this.auditWriter.append(manager, {
            organizationId: org,
            projectId,
            action: AuditAction.APPROVAL_RESPONSE_RECORDED,
            actor: {
              type: AuditActorType.HUMAN,
              id: actor.userId,
              label: `User ${actor.userId}`,
            },
            subject: {
              type: AuditSubjectType.APPROVAL_REQUEST,
              id: request.id,
              label: `${request.subject_type} approval`,
            },
            source: AuditSource.API,
            correlationId: this.auditWriter.correlationId(),
            before: { status: ApprovalRequestStatus.PENDING },
            after: { status: request.status, decision: dto.decision },
          });
      });
      if (invalidated)
        throw new BadRequestException(
          'Approval invalidated because the subject changed',
        );
      return this.get(actor, org, projectId, id);
    } catch (e) {
      console.log(e);
    }
  }
  private async load(org: string, projectId: number, id: string) {
    const row = await this.dataSource.getRepository(ApprovalRequest).findOne({
      where: { id, organization_id: org, project_id: projectId },
      relations: [
        'reviewers',
        'reviewers.reviewer',
        'responses',
        'responses.reviewer',
        'requested_by',
      ],
    });
    if (!row) throw new NotFoundException('Approval request not found');
    return row;
  }
  private async assertReviewers(org: string, projectId: number, ids: number[]) {
    const members = await this.dataSource
      .getRepository(UserOrganization)
      .count({
        where: { organization_id: org, user_id: In(ids), is_active: true },
      });
    const project = await this.dataSource.getRepository(Project).findOne({
      where: { id: projectId, organization_id: org },
      relations: ['user'],
    });
    const peers = await this.dataSource.getRepository(ProjectPeer).find({
      where: {
        organization_id: org,
        project: { id: projectId },
        user: { id: In(ids) },
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user'],
    });
    const projectMemberIds = new Set([
      Number(project?.user?.id),
      ...peers.map((peer) => Number(peer.user?.id)),
    ]);
    if (members !== ids.length || ids.some((id) => !projectMemberIds.has(id)))
      throw new BadRequestException('Reviewers must be active project members');
  }
  private async snapshot(
    org: string,
    projectId: number,
    type: ApprovalSubjectType,
    id: string,
  ) {
    let subject: any;
    if (type === ApprovalSubjectType.TASK)
      subject = await this.dataSource.getRepository(Task).findOne({
        where: {
          id: Number(id),
          organization_id: org,
          project: { id: projectId },
        },
        relations: ['status'],
      });
    if (type === ApprovalSubjectType.DOCUMENT)
      subject = await this.dataSource.getRepository(Document).findOne({
        where: { id, organization_id: org, project: { id: projectId } },
      });
    if (type === ApprovalSubjectType.MILESTONE)
      subject = await this.dataSource.getRepository(Milestone).findOne({
        where: { id, organization_id: org, project_id: projectId },
      });
    if (!subject) throw new NotFoundException('Approval subject not found');
    const updated = subject.updated_at ?? subject.updatedAt;
    const snapshot =
      type === ApprovalSubjectType.TASK
        ? {
            id: subject.id,
            title: subject.title,
            description: subject.description,
            status: subject.status?.title,
            dueDate: subject.due_date,
          }
        : type === ApprovalSubjectType.DOCUMENT
          ? {
              id: subject.id,
              title: subject.title,
              version: subject.version,
              published: subject.isPublished,
            }
          : {
              id: subject.id,
              title: subject.title,
              description: subject.description,
              status: subject.status,
              health: subject.health,
              targetDate: subject.target_date,
            };
    return { snapshot, revision: new Date(updated).toISOString() };
  }
  private serialize(row: ApprovalRequest, actorId: number) {
    return {
      id: row.id,
      projectId: row.project_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      subject: row.subject_snapshot,
      status: row.status,
      message: row.message,
      dueAt: row.due_at,
      rejectionCommentRequired: row.rejection_comment_required,
      requestedBy: row.requested_by
        ? {
            id: row.requested_by.id,
            name: `${row.requested_by.first_name ?? ''} ${
              row.requested_by.last_name ?? ''
            }`.trim(),
          }
        : null,
      reviewers: (row.reviewers ?? []).map((item) => ({
        id: item.reviewer_id,
        name: `${item.reviewer?.first_name ?? ''} ${
          item.reviewer?.last_name ?? ''
        }`.trim(),
      })),
      responses: (row.responses ?? []).map((item) => ({
        id: item.id,
        reviewerId: item.reviewer_id,
        reviewer: item.reviewer
          ? {
              id: item.reviewer.id,
              name:
                `${item.reviewer.first_name ?? ''} ${
                  item.reviewer.last_name ?? ''
                }`.trim() || item.reviewer.email,
              email: item.reviewer.email,
            }
          : null,
        decision: item.decision,
        comment: item.comment,
        createdAt: item.created_at,
      })),
      canRespond:
        row.status === ApprovalRequestStatus.PENDING &&
        row.reviewers?.some(
          (item) => Number(item.reviewer_id) === Number(actorId),
        ) &&
        !row.responses?.some(
          (item) => Number(item.reviewer_id) === Number(actorId),
        ),
      invalidationReason: row.invalidation_reason,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }
}
