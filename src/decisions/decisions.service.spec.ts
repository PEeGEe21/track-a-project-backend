import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CAPABILITY_CATALOG,
  CapabilityKey,
} from 'src/entitlements/capability-catalog';
import { DecisionStatus } from 'src/typeorm/entities/Decision';
import { DecisionLinkType } from 'src/typeorm/entities/DecisionLink';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { DecisionsService } from './decisions.service';

const repo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn((value) => Promise.resolve(value)),
  delete: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: { transaction: jest.fn() },
});

describe('DecisionsService', () => {
  let service: DecisionsService;
  let decisions: any;
  let histories: any;
  let projects: any;
  let peers: any;
  let users: any;
  let tasks: any;
  const actor = { userId: 2 };
  const org = 'org-1';
  const project = {
    id: 9,
    organization_id: org,
    user: { id: 1, fullName: 'Owner' },
  };

  beforeEach(() => {
    decisions = repo();
    const links = repo();
    histories = repo();
    projects = repo();
    peers = repo();
    users = repo();
    tasks = repo();
    const documents = repo();
    const messages = repo();
    const notes = repo();
    users.findOne.mockResolvedValue({ id: 2, fullName: 'Member' });
    projects.findOne.mockResolvedValue(project);
    service = new DecisionsService(
      decisions as any,
      links as any,
      histories as any,
      projects as any,
      peers as any,
      users as any,
      tasks as any,
      documents as any,
      messages as any,
      notes as any,
      { record: jest.fn(), history: jest.fn() } as any,
    );
  });

  const asRole = (role: ProjectRole) =>
    peers.findOne.mockResolvedValue({
      role,
      user: { id: 2, fullName: 'Member' },
    });

  it('registers a default-off pilot capability and durable lifecycle', () => {
    expect(
      CAPABILITY_CATALOG[CapabilityKey.DECISION_REGISTER].defaultEnabled,
    ).toBe(false);
    expect(Object.values(DecisionStatus)).toEqual([
      'proposed',
      'accepted',
      'rejected',
      'superseded',
    ]);
  });

  it('hides proposals from viewers and paginates filtered decisions', async () => {
    asRole(ProjectRole.VIEWER);
    decisions.findAndCount.mockResolvedValue([[{ id: 1 }], 13]);
    const result = await service.list(
      actor,
      org,
      9,
      {
        status: DecisionStatus.ACCEPTED,
        ownerId: 4,
        from: '2026-01-01',
        to: '2026-12-31',
      },
      2,
      10,
    );
    expect(decisions.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.meta).toMatchObject({
      current_page: 2,
      last_page: 2,
      total: 13,
      from: 11,
      to: 11,
    });
    await expect(
      service.list(actor, org, 9, { status: DecisionStatus.PROPOSED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires contributor access to propose', async () => {
    asRole(ProjectRole.VIEWER);
    await expect(
      service.create(actor, org, 9, {
        title: 'A',
        context: 'B',
        owner_id: 1,
        decision_date: '2026-07-18',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('shows contributors public decisions plus only their own proposals', async () => {
    asRole(ProjectRole.CONTRIBUTOR);
    decisions.findAndCount.mockResolvedValue([[], 0]);
    await service.list(actor, org, 9, {});
    const where = decisions.findAndCount.mock.calls[0][0].where;
    expect(where).toHaveLength(2);
    expect(where[1]).toMatchObject({
      status: DecisionStatus.PROPOSED,
      created_by_id: 2,
    });
  });

  it('allows contributors to edit only their own proposals', async () => {
    asRole(ProjectRole.CONTRIBUTOR);
    decisions.findOne.mockResolvedValue({
      id: 3,
      project_id: 9,
      organization_id: org,
      status: DecisionStatus.PROPOSED,
      created_by_id: 7,
      links: [],
    });
    await expect(
      service.update(actor, org, 9, 3, {
        title: 'A',
        context: 'B',
        owner_id: 1,
        decision_date: '2026-07-18',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only transitions proposals and only to accepted or rejected', async () => {
    asRole(ProjectRole.EDITOR);
    decisions.findOne.mockResolvedValue({
      id: 3,
      status: DecisionStatus.ACCEPTED,
    });
    await expect(
      service.transition(actor, org, 9, 3, DecisionStatus.REJECTED),
    ).rejects.toBeInstanceOf(BadRequestException);
    decisions.findOne.mockResolvedValue({
      id: 3,
      status: DecisionStatus.PROPOSED,
    });
    await expect(
      service.transition(actor, org, 9, 3, DecisionStatus.SUPERSEDED),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never deletes accepted, rejected, or superseded decisions', async () => {
    asRole(ProjectRole.OWNER);
    for (const status of [
      DecisionStatus.ACCEPTED,
      DecisionStatus.REJECTED,
      DecisionStatus.SUPERSEDED,
    ]) {
      decisions.findOne.mockResolvedValue({ id: 3, status });
      await expect(
        service.removeProposal(actor, org, 9, 3),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(decisions.remove).not.toHaveBeenCalled();
  });

  it('rejects cross-project task links', async () => {
    asRole(ProjectRole.EDITOR);
    tasks.findOne.mockResolvedValue(null);
    decisions.findOne.mockResolvedValue({
      id: 3,
      status: DecisionStatus.PROPOSED,
      created_by_id: 2,
    });
    projects.findOne.mockResolvedValue(project);
    await expect(
      service.update(actor, org, 9, 3, {
        title: 'A',
        context: 'B',
        owner_id: 1,
        decision_date: '2026-07-18',
        links: [{ type: DecisionLinkType.TASK, id: '999' }],
      }),
    ).rejects.toThrow('Invalid task link 999 for this project');
  });

  it('paginates history with a maximum page size of 50', async () => {
    asRole(ProjectRole.EDITOR);
    decisions.findOne.mockResolvedValue({
      id: 3,
      status: DecisionStatus.ACCEPTED,
    });
    histories.findAndCount.mockResolvedValue([[{ id: 10 }], 51]);
    const result = await service.history(actor, org, 9, 3, 2, 500);
    expect(histories.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 50 }),
    );
    expect(result.meta).toMatchObject({
      current_page: 2,
      last_page: 2,
      total: 51,
    });
  });

  it('supersedes an accepted decision transactionally without deleting it', async () => {
    asRole(ProjectRole.EDITOR);
    const old = { id: 3, status: DecisionStatus.ACCEPTED, links: [] };
    decisions.findOne.mockResolvedValue(old);
    projects.findOne.mockResolvedValue(project);
    const manager = {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => value),
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 4, status: DecisionStatus.ACCEPTED }),
      delete: jest.fn(),
    };
    decisions.manager.transaction.mockImplementation((work: any) =>
      work(manager),
    );
    const result = await service.supersede(actor, org, 9, 3, {
      title: 'Replacement',
      context: 'New rationale',
      owner_id: 1,
      decision_date: '2026-07-18',
    });
    expect(old.status).toBe(DecisionStatus.SUPERSEDED);
    expect(result).toMatchObject({ id: 4, status: DecisionStatus.ACCEPTED });
    expect(manager.delete).not.toHaveBeenCalled();
  });
});
