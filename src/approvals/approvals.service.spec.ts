import {
  ApprovalRequestStatus,
  ApprovalSubjectType,
} from 'src/typeorm/entities/ApprovalRequest';
import { ApprovalDecision } from 'src/typeorm/entities/ApprovalResponse';
import { ApprovalsService } from './approvals.service';
describe('ApprovalsService contract', () => {
  const service = new ApprovalsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  it('only allows an assigned reviewer without an existing response to respond', () => {
    const base: any = {
      id: 'a',
      project_id: 1,
      subject_snapshot: {},
      status: ApprovalRequestStatus.PENDING,
      reviewers: [{ reviewer_id: 2 }],
      responses: [],
      created_at: new Date(),
    };
    expect((service as any).serialize(base, 2).canRespond).toBe(true);
    expect(
      (service as any).serialize(
        { ...base, responses: [{ reviewer_id: 2 }] },
        2,
      ).canRespond,
    ).toBe(false);
    expect((service as any).serialize(base, 3).canRespond).toBe(false);
  });
  it('does not expose response mutation controls after resolution', () => {
    const row: any = {
      project_id: 1,
      subject_snapshot: {},
      status: ApprovalRequestStatus.APPROVED,
      reviewers: [{ reviewer_id: 2 }],
      responses: [],
      created_at: new Date(),
    };
    expect((service as any).serialize(row, 2).canRespond).toBe(false);
  });
  it('records a response and updates the request without resaving its relations', async () => {
    const request: any = {
      id: '6df75a4d-9793-47cf-a3f4-5f3f5305d413',
      organization_id: 'org',
      project_id: 1,
      subject_type: ApprovalSubjectType.TASK,
      subject_id: '10',
      subject_revision: 'revision-1',
      status: ApprovalRequestStatus.PENDING,
      reviewers: [{ reviewer_id: 3 }],
      responses: [],
    };
    const requestRepository = {
      findOne: jest.fn().mockResolvedValue(request),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const auditRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getRepository: jest.fn((entity: any) =>
        entity.name === 'ApprovalRequest' ? requestRepository : auditRepository,
      ),
      query: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      transaction: jest.fn(async (run: any) => run(manager)),
    };
    const authorization = {
      assertProjectPermission: jest.fn().mockResolvedValue(undefined),
    };
    const respondingService = new ApprovalsService(
      dataSource as any,
      authorization as any,
      {} as any,
      { resolveForActor: jest.fn().mockResolvedValue([]) } as any,
      { append: jest.fn(), correlationId: jest.fn() } as any,
    );
    jest
      .spyOn(respondingService as any, 'snapshot')
      .mockResolvedValue({ snapshot: { id: 10 }, revision: 'revision-1' });
    jest
      .spyOn(respondingService as any, 'get')
      .mockResolvedValue({ success: true, data: {} });

    await respondingService.respond(
      { userId: 3 } as any,
      'org',
      1,
      request.id,
      { decision: ApprovalDecision.APPROVED },
    );

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO `approval_responses`'),
      expect.arrayContaining([request.id, 3, ApprovalDecision.APPROVED]),
    );
    expect(requestRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: request.id }),
      expect.objectContaining({ status: ApprovalRequestStatus.APPROVED }),
    );
  });
});
