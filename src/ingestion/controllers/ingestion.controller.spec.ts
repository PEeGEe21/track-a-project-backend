import { HttpStatus } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';

describe('IngestionController', () => {
  const ingestionService = {
    ingestTaskEvent: jest.fn(),
  };

  let controller: IngestionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IngestionController(ingestionService as any);
  });

  it('returns 201 for created tasks', async () => {
    ingestionService.ingestTaskEvent.mockResolvedValue({
      status: 'created',
      taskId: 10,
      occurrenceCount: 1,
    });

    const res = {
      status: jest.fn(),
    } as any;

    await expect(
      controller.ingestTask(
        { source: 'sdk', title: 'Build failed' } as any,
        { ingestionContext: { ingestKeyId: 1 } } as any,
        res,
      ),
    ).resolves.toEqual({
      status: 'created',
      taskId: 10,
      occurrenceCount: 1,
    });

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
  });

  it('returns 200 for test validation responses', async () => {
    ingestionService.ingestTaskEvent.mockResolvedValue({
      status: 'validated',
      test: true,
    });

    const res = {
      status: jest.fn(),
    } as any;

    await controller.ingestTask(
      { source: 'sdk', title: 'Build failed' } as any,
      { ingestionContext: { ingestKeyId: 1 } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });
});
