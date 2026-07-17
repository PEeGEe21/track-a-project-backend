import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectUpdateHealth, ProjectUpdateStatus } from 'src/typeorm/entities/ProjectUpdate';
import { ProjectUpdatesService } from './project-updates.service';

describe('ProjectUpdatesService', () => {
  const updates = { findOne: jest.fn(), save: jest.fn(), findAndCount: jest.fn(), delete: jest.fn() };
  const projects = { findOne: jest.fn() };
  const peers = { findOne: jest.fn(), find: jest.fn() };
  const users = { findOne: jest.fn() };
  const tasks = { findOne: jest.fn(), findAndCount: jest.fn() };
  const documents = { findOne: jest.fn(), findAndCount: jest.fn() };
  const memberships = { findOne: jest.fn() };
  const notifications = { createNotification: jest.fn() };
  const service = new ProjectUpdatesService(
    { transaction: jest.fn() } as any,
    updates as any,
    projects as any,
    peers as any,
    tasks as any,
    documents as any,
    users as any,
    memberships as any,
    notifications as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('never edits a published snapshot in place', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue({ id: 3, user: { id: 7 } });
    peers.findOne.mockResolvedValue(null);
    updates.findOne.mockResolvedValue({ id: 11, project_id: 3, organization_id: 'org', status: ProjectUpdateStatus.PUBLISHED });

    await expect(service.updateDraft({ userId: 7 }, 'org', 3, 11, { health: ProjectUpdateHealth.ON_TRACK })).rejects.toBeInstanceOf(BadRequestException);
    expect(updates.save).not.toHaveBeenCalled();
  });

  it('hides drafts unless the caller explicitly asks for them', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue({ id: 3, user: { id: 7 } });
    peers.findOne.mockResolvedValue(null);
    updates.findAndCount.mockResolvedValue([[], 0]);

    await service.list({ userId: 7 }, 'org', 3, false);
    const options = updates.findAndCount.mock.calls[0][0];
    expect(options.where.status.value).toEqual([ProjectUpdateStatus.PUBLISHED]);
    expect(options.where.is_latest).toBe(true);
  });

  it('limits viewers to published updates and prevents draft creation', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue({ id: 3, user: { id: 1 } });
    peers.findOne.mockResolvedValue({ role: ProjectRole.VIEWER });
    updates.findAndCount.mockResolvedValue([[], 0]);

    await service.list({ userId: 7 }, 'org', 3, true);
    expect(updates.findAndCount.mock.calls[0][0].where.status.value).toEqual([ProjectUpdateStatus.PUBLISHED]);
    await expect(service.createDraft({ userId: 7 }, 'org', 3, { health: ProjectUpdateHealth.ON_TRACK, accomplishments: 'Work' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('paginates update history with a bounded page size', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue({ id: 3, user: { id: 7 } });
    peers.findOne.mockResolvedValue(null);
    updates.findAndCount.mockResolvedValue([[{ id: 11 }], 51]);

    const result = await service.list({ userId: 7 }, 'org', 3, true, 2, 100);
    expect(updates.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 50 }));
    expect(result.meta).toEqual(expect.objectContaining({ current_page: 2, per_page: 50, total: 51, last_page: 2 }));
  });

  it('applies draft, health, and current-author filters server-side', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue({ id: 3, user: { id: 7 } });
    peers.findOne.mockResolvedValue(null);
    updates.findAndCount.mockResolvedValue([[], 0]);

    await service.list({ userId: 7 }, 'org', 3, true, 1, 10, { status: 'draft', health: 'at_risk', mine: true });
    const where = updates.findAndCount.mock.calls[0][0].where;
    expect(where.status.value).toEqual([ProjectUpdateStatus.DRAFT]);
    expect(where.health).toBe(ProjectUpdateHealth.AT_RISK);
    expect(where.author_id).toBe(7);
  });

  it('searches and paginates project-scoped task reference options', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue({ id: 3, user: { id: 7 } });
    peers.findOne.mockResolvedValue(null);
    tasks.findAndCount.mockResolvedValue([[{ id: 9, title: 'Release API' }], 1]);

    const result = await service.referenceOptions({ userId: 7 }, 'org', 3, 'task', 'Release', 1, 20);
    expect(result.data).toEqual([{ id: '9', label: 'Release API' }]);
    const options = tasks.findAndCount.mock.calls[0][0];
    expect(options.where).toEqual(expect.objectContaining({ organization_id: 'org', project: { id: 3 } }));
    expect(options.take).toBe(20);
  });

  it('allows draft deletion but protects published snapshots', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue({ id: 3, user: { id: 7 } });
    peers.findOne.mockResolvedValue(null);
    updates.findOne.mockResolvedValueOnce({ id: 12, status: ProjectUpdateStatus.DRAFT });
    await service.deleteDraft({ userId: 7 }, 'org', 3, 12);
    expect(updates.delete).toHaveBeenCalledWith({ id: 12 });

    updates.findOne.mockResolvedValueOnce({ id: 13, status: ProjectUpdateStatus.PUBLISHED });
    await expect(service.deleteDraft({ userId: 7 }, 'org', 3, 13)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inverted reporting period', () => {
    expect(() => (service as any).content({ health: ProjectUpdateHealth.AT_RISK, reporting_period_start: '2026-07-31', reporting_period_end: '2026-07-01' })).toThrow(BadRequestException);
  });

  it('does not reveal projects from another organization', async () => {
    users.findOne.mockResolvedValue({ id: 7 });
    projects.findOne.mockResolvedValue(null);
    await expect(service.list({ userId: 7 }, 'other-org', 3)).rejects.toBeInstanceOf(NotFoundException);
    expect(updates.findAndCount).not.toHaveBeenCalled();
  });

  it('rejects task references outside the authorized project scope', async () => {
    tasks.findOne.mockResolvedValue(null);
    const referenceRepo = { create: jest.fn() };
    await expect((service as any).buildReferences({ references: [{ type: 'task', id: '99' }] }, 'org', 3, referenceRepo, 12)).rejects.toBeInstanceOf(BadRequestException);
    expect(tasks.findOne).toHaveBeenCalledWith({ where: { id: 99, organization_id: 'org', project: { id: 3 } } });
  });

  it('rejects milestone references until milestones have an authorized domain model', async () => {
    await expect((service as any).buildReferences({ references: [{ type: 'milestone', id: 'release-1', label: 'Release 1' }] }, 'org', 3, { create: jest.fn() }, 12)).rejects.toThrow('Milestone references are unavailable');
  });

  it('notifies each connected member once and excludes the publisher', async () => {
    const owner = { id: 1 };
    const publisher = { id: 2 };
    const member = { id: 3 };
    peers.find.mockResolvedValue([{ user: publisher }, { user: member }, { user: member }]);
    notifications.createNotification.mockResolvedValue({ success: true });

    await (service as any).notifyMembers({ id: 3, title: 'Launch', user: owner }, publisher, { id: 44 }, 'org');

    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    expect(notifications.createNotification.mock.calls.map((call) => call[1].recipient.id).sort()).toEqual([1, 3]);
    expect(notifications.createNotification.mock.calls[0][1].metadata.deliveryKey).toContain('project-update:44:');
  });
});
