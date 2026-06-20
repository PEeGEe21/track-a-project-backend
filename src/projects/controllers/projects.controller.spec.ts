import { ProjectsController } from './projects.controller';

describe('ProjectsController ingestion settings routes', () => {
  const projectService = {
    listIngestKeysForProject: jest.fn(),
    createIngestKeyForProject: jest.fn(),
    revokeIngestKeyForProject: jest.fn(),
    updateDefaultIngestionStatus: jest.fn(),
  };

  let controller: ProjectsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectsController(projectService as any);
  });

  it('delegates ingest-key listing with user and organization context', async () => {
    projectService.listIngestKeysForProject.mockResolvedValue({
      success: true,
      data: [],
    });

    await expect(
      controller.listIngestKeys(
        7,
        { user: { userId: 10 } } as any,
        'org_1',
      ),
    ).resolves.toEqual({
      success: true,
      data: [],
    });

    expect(projectService.listIngestKeysForProject).toHaveBeenCalledWith(
      { userId: 10 },
      7,
      'org_1',
    );
  });

  it('delegates live key creation with the live mode flag', async () => {
    projectService.createIngestKeyForProject.mockResolvedValue({
      success: true,
      data: { apiKey: 'trk_live_secret' },
    });

    const dto = { label: 'Production key' };

    await controller.createLiveIngestKey(
      7,
      dto,
      { user: { userId: 10 } } as any,
      'org_1',
    );

    expect(projectService.createIngestKeyForProject).toHaveBeenCalledWith(
      { userId: 10 },
      7,
      'org_1',
      'live',
      dto,
    );
  });

  it('delegates test key creation with the test mode flag', async () => {
    projectService.createIngestKeyForProject.mockResolvedValue({
      success: true,
      data: { apiKey: 'trk_test_secret' },
    });

    const dto = { label: 'Sandbox key' };

    await controller.createTestIngestKey(
      7,
      dto,
      { user: { userId: 10 } } as any,
      'org_1',
    );

    expect(projectService.createIngestKeyForProject).toHaveBeenCalledWith(
      { userId: 10 },
      7,
      'org_1',
      'test',
      dto,
    );
  });

  it('delegates key revocation with project and key ids', async () => {
    projectService.revokeIngestKeyForProject.mockResolvedValue({
      success: true,
    });

    await controller.revokeIngestKey(
      7,
      22,
      { user: { userId: 10 } } as any,
      'org_1',
    );

    expect(projectService.revokeIngestKeyForProject).toHaveBeenCalledWith(
      { userId: 10 },
      7,
      22,
      'org_1',
    );
  });

  it('delegates default ingestion status updates with the dto value', async () => {
    projectService.updateDefaultIngestionStatus.mockResolvedValue({
      success: true,
    });

    await controller.updateDefaultIngestionStatus(
      7,
      { default_ingestion_status_id: 4 },
      { user: { userId: 10 } } as any,
      'org_1',
    );

    expect(projectService.updateDefaultIngestionStatus).toHaveBeenCalledWith(
      { userId: 10 },
      7,
      'org_1',
      4,
    );
  });
});
