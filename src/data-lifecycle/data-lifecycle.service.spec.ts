import { DataLifecycleService } from './data-lifecycle.service';
import { LifecycleRecordType } from 'src/typeorm/entities/DataLifecycleEvent';

describe('DataLifecycleService', () => {
  const repository: any = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('stores content-free operational metadata', async () => {
    const service = new DataLifecycleService(repository);
    await service.record({
      organizationId: 'org-1',
      actorId: 2,
      recordType: LifecycleRecordType.DECISION,
      recordId: 10,
      action: 'deleted',
      metadata: { deletion: 'hard' },
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        record_id: '10',
        metadata: { deletion: 'hard' },
      }),
    );
  });

  it('rejects source content in lifecycle metadata', async () => {
    const service = new DataLifecycleService(repository);
    expect(() =>
      service.record({
        organizationId: 'org-1',
        actorId: 2,
        recordType: LifecycleRecordType.NOTE_AUDIO,
        recordId: 3,
        action: 'deleted',
        metadata: { transcript: 'sensitive' } as any,
      }),
    ).toThrow('must not contain source content');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
