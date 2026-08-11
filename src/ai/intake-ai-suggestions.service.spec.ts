import { IntakeAiSuggestionsService } from './intake-ai-suggestions.service';
import { IntakeAiSuggestion } from 'src/typeorm/entities/IntakeAiSuggestion';
import { IntakeEvent } from 'src/typeorm/entities/IntakeEvent';
import { Task } from 'src/typeorm/entities/Task';
import { AuditLog } from 'src/typeorm/entities/AuditLog';

describe('IntakeAiSuggestionsService', () => {
  const actor = { userId: 7 } as any;
  const authorization = { assertProjectPermission: jest.fn() };
  const entitlements = { assertCapability: jest.fn() };
  const ai = { assist: jest.fn() };
  const governance = { markPostprocessingFailure: jest.fn() };
  const matchingContext = { assemble: jest.fn() };
  const dataSource = { getRepository: jest.fn(), transaction: jest.fn() };
  const audits = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const events = { findOne: jest.fn() };
  const suggestions = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'suggestion-1', ...value })),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
  };
  let service: IntakeAiSuggestionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    governance.markPostprocessingFailure.mockResolvedValue(undefined);
    service = new IntakeAiSuggestionsService(
      authorization as any,
      entitlements as any,
      ai as any,
      governance as any,
      matchingContext as any,
      dataSource as any,
      events as any,
      suggestions as any,
      audits as any,
    );
    events.findOne.mockResolvedValue({
      id: 'event-1',
      normalized_payload: { title: 'Alert', priority: 2 },
    });
    matchingContext.assemble.mockResolvedValue({
      sourceProjectId: 4,
      projects: [
        { id: 4, title: 'Operations', members: [{ id: 7, name: 'Ada' }] },
        { id: 8, title: 'Checkout', members: [{ id: 9, name: 'Grace' }] },
      ],
      duplicateTasks: [{ id: 21, projectId: 8, title: 'Checkout alert' }],
      categories: ['Incident'],
    });
  });

  it('selectively applies ordinary fields and closes the suggestion atomically', async () => {
    const pending = {
      id: 'suggestion-1',
      event_id: 'event-1',
      organization_id: 'org-1',
      project_id: 4,
      state: 'pending',
      proposed_changes: { title: 'Clear alert title', priority: 1 },
      payload_fingerprint:
        '658b10b25826323fe14137836e0820bf18c50dec4ff138add208c07575f783b0',
    };
    const currentEvent = {
      id: 'event-1',
      task_id: 20,
      normalized_payload: { title: 'Alert', priority: 2 },
    };
    const task = {
      id: 20,
      title: 'Alert',
      priority: 2,
      project: { id: 4 },
      assignees: [],
      categories: [],
    };
    suggestions.findOne.mockResolvedValue(pending);
    const suggestionRepo = { findOne: jest.fn().mockResolvedValue(pending) };
    const eventRepo = { findOne: jest.fn().mockResolvedValue(currentEvent) };
    const taskRepo = {
      findOne: jest.fn().mockResolvedValue(task),
      save: jest.fn(async (value) => value),
    };
    const auditRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === IntakeAiSuggestion
          ? suggestionRepo
          : entity === IntakeEvent
            ? eventRepo
            : entity === Task
              ? taskRepo
              : entity === AuditLog
                ? auditRepo
              : {},
      ),
      save: jest.fn(async (value) => value),
    };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    await expect(
      service.apply(actor, 'org-1', 4, 'suggestion-1', {
        fields: ['title', 'priority'],
      }),
    ).resolves.toEqual({
      applied: true,
      fields: ['title', 'priority'],
      taskId: 20,
    });
    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Clear alert title', priority: 1 }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'applied', reviewed_by_id: 7 }),
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_INTAKE_SUGGESTION_APPLIED',
        metadata: expect.objectContaining({ fields: ['title', 'priority'] }),
      }),
    );
  });

  it('requires separate confirmation for routing and duplicate merge', async () => {
    suggestions.findOne.mockResolvedValue({
      id: 'suggestion-1',
      state: 'pending',
      proposed_changes: { destinationProjectId: 8, duplicateTaskId: 21 },
    });
    await expect(
      service.apply(actor, 'org-1', 4, 'suggestion-1', {
        fields: ['destinationProjectId'],
      }),
    ).rejects.toThrow('Routing confirmation is required');
    await expect(
      service.apply(actor, 'org-1', 4, 'suggestion-1', {
        fields: ['duplicateTaskId', 'destinationProjectId'],
        confirmDuplicateMerge: true,
        confirmRouting: true,
      }),
    ).rejects.toThrow('Duplicate merge may only include');
  });

  it('marks a suggestion stale before applying when the normalized payload changed', async () => {
    suggestions.findOne.mockResolvedValue({
      id: 'suggestion-1',
      event_id: 'event-1',
      state: 'pending',
      proposed_changes: { title: 'Clear alert title' },
      payload_fingerprint: '0'.repeat(64),
    });
    suggestions.update.mockResolvedValue({ affected: 1 });

    await expect(
      service.apply(actor, 'org-1', 4, 'suggestion-1', { fields: ['title'] }),
    ).rejects.toThrow('Suggestion is stale');
    expect(suggestions.update).toHaveBeenCalledWith(
      { id: 'suggestion-1', state: 'pending' },
      expect.objectContaining({ state: 'stale', reviewed_by_id: 7 }),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('generates and persists a strictly parsed governed suggestion', async () => {
    ai.assist.mockResolvedValue({
      correlationId: 'audit-2',
      draft: JSON.stringify({
        changes: {
          title: 'Investigate checkout alert',
          priority: 1,
          duplicateTaskId: 21,
          destinationProjectId: 8,
          assigneeId: 9,
        },
        reasons: {
          title: 'Names the affected service',
          priority: 'Production impact is described',
          duplicateTaskId: 'The candidate describes the same alert',
          destinationProjectId: 'Checkout owns the affected service',
          assigneeId: 'Member of the destination project',
        },
        confidence: {
          title: 0.93,
          priority: 0.81,
          duplicateTaskId: 0.76,
          destinationProjectId: 0.88,
          assigneeId: 0.72,
        },
      }),
    });

    await expect(
      service.generate(actor, 'org-1', 4, 'event-1'),
    ).resolves.toEqual(expect.objectContaining({
      state: 'pending',
      correlation_id: 'audit-2',
      proposed_changes: {
        title: 'Investigate checkout alert',
        priority: 1,
        duplicateTaskId: 21,
        destinationProjectId: 8,
        assigneeId: 9,
      },
    }));
    expect(ai.assist).toHaveBeenCalledWith(
      actor,
      'org-1',
      expect.objectContaining({ featureId: 'suggest_intake' }),
    );
    const sent = JSON.parse(ai.assist.mock.calls[0][2].input);
    expect(sent).toEqual({
      title: 'Alert',
      priority: 2,
      candidates: {
        projects: [
          { id: 4, title: 'Operations', members: [{ id: 7, name: 'Ada' }] },
          { id: 8, title: 'Checkout', members: [{ id: 9, name: 'Grace' }] },
        ],
        duplicateTasks: [{ id: 21, projectId: 8, title: 'Checkout alert' }],
        categories: ['Incident'],
      },
    });
  });

  it('rejects malformed or unauthorized output and drops unexplained fields', async () => {
    ai.assist.mockResolvedValueOnce({ correlationId: 'audit-2', draft: 'not json' });
    await expect(service.generate(actor, 'org-1', 4, 'event-1')).rejects.toThrow(
      'invalid suggestion format',
    );
    expect(governance.markPostprocessingFailure).toHaveBeenCalledWith(
      'org-1',
      'audit-2',
      'invalid_structured_output',
    );

    ai.assist.mockResolvedValueOnce({
      correlationId: 'audit-3',
      draft: JSON.stringify({
        changes: { statusId: 5 },
        reasons: { statusId: 'Unsupported field' },
        confidence: { statusId: 0.8 },
      }),
    });
    await expect(service.generate(actor, 'org-1', 4, 'event-1')).rejects.toThrow(
      'unsupported intake changes',
    );

    ai.assist.mockResolvedValueOnce({
      correlationId: 'audit-unauthorized',
      draft: JSON.stringify({
        changes: { destinationProjectId: 999 },
        reasons: { destinationProjectId: 'Invented destination' },
        confidence: { destinationProjectId: 0.9 },
      }),
    });
    await expect(service.generate(actor, 'org-1', 4, 'event-1')).rejects.toThrow(
      'unauthorized destination project',
    );

    ai.assist.mockResolvedValueOnce({
      correlationId: 'audit-4',
      draft: JSON.stringify({
        changes: { priority: 1 },
        reasons: {},
        confidence: { priority: 0.8 },
      }),
    });
    await expect(service.generate(actor, 'org-1', 4, 'event-1')).resolves.toEqual(
      expect.objectContaining({ noChanges: true, suggestion: null }),
    );
  });

  it('drops an invalid optional title instead of failing the whole request', async () => {
    ai.assist.mockResolvedValue({
      correlationId: 'audit-invalid-title',
      draft: JSON.stringify({
        changes: { title: { value: 'Nested title' } },
        reasons: { title: 'Provider used the wrong shape' },
        confidence: { title: 0.8 },
      }),
    });
    await expect(service.generate(actor, 'org-1', 4, 'event-1')).resolves.toEqual({
      suggestion: null,
      noChanges: true,
      correlationId: 'audit-invalid-title',
      requiresReview: false,
    });
    expect(suggestions.save).not.toHaveBeenCalled();
  });

  it('repairs the provider value-keyed reasons and confidence JSON pattern', async () => {
    ai.assist.mockResolvedValue({
      correlationId: 'audit-repaired',
      draft: `{
        "changes":{"title":"Checkout delete failed","category":"Incident","priority":1,"duplicateTaskId":"21","destinationProjectId":"8","assigneeId":"9"},
        "reasons":{
          "title":"Checkout delete failed":"Accurately describes the event",
          "category":"Incident":"Matches the existing category",
          "priority":1:"Reflects the reported severity",
          "duplicateTaskId":"21":"Matches the same alert",
          "destinationProjectId":"8":"Checkout owns the service",
          "assigneeId":"9":"Member of the destination project"
        },
        "confidence":{
          "title":"Checkout delete failed":1,
          "category":"Incident":1,
          "priority":1:0.95,
          "duplicateTaskId":"21":0.9,
          "destinationProjectId":"8":0.9,
          "assigneeId":"9":0.9
        }
      }`,
    });

    await expect(service.generate(actor, 'org-1', 4, 'event-1')).resolves.toEqual(
      expect.objectContaining({
        proposed_changes: expect.objectContaining({
          title: 'Checkout delete failed',
          category: 'Incident',
          priority: 1,
          duplicateTaskId: 21,
          destinationProjectId: 8,
          assigneeId: 9,
        }),
      }),
    );
  });

  it('treats an empty supported response as no changes instead of an error', async () => {
    ai.assist.mockResolvedValue({
      correlationId: 'audit-no-change',
      draft: JSON.stringify({ changes: {}, reasons: {}, confidence: {} }),
    });

    await expect(service.generate(actor, 'org-1', 4, 'event-1')).resolves.toEqual({
      suggestion: null,
      noChanges: true,
      correlationId: 'audit-no-change',
      requiresReview: false,
    });
    expect(suggestions.save).not.toHaveBeenCalled();
    expect(governance.markPostprocessingFailure).not.toHaveBeenCalled();
  });

  it('normalizes unambiguous numeric strings and null omissions', async () => {
    ai.assist.mockResolvedValue({
      correlationId: 'audit-normalized',
      draft: JSON.stringify({
        changes: { title: null, priority: '1', duplicateTaskId: '21' },
        reasons: {
          title: 'No title change',
          priority: 'Production impact',
          duplicateTaskId: 'Same checkout alert',
        },
        confidence: { title: 0, priority: '0.8', duplicateTaskId: '0.75' },
      }),
    });

    await expect(service.generate(actor, 'org-1', 4, 'event-1')).resolves.toEqual(
      expect.objectContaining({
        proposed_changes: { priority: 1, duplicateTaskId: 21 },
        confidence: { priority: 0.8, duplicateTaskId: 0.75 },
      }),
    );
  });

  it('creates a review-only suggestion with a stable payload fingerprint', async () => {
    const result = await service.createPending(actor, 'org-1', 4, {
      eventId: 'event-1',
      proposedChanges: { title: 'Investigate checkout alert', priority: 1 },
      reasons: { title: 'Clarifies the affected service', priority: 'Production impact' },
      confidence: { title: 0.94, priority: 0.8 },
      correlationId: 'audit-1',
      templateId: 'intake_suggestions',
      templateVersion: 1,
    });

    expect(result).toEqual(expect.objectContaining({ state: 'pending' }));
    expect(suggestions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payload_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        reviewed_by_id: null,
        contract_version: 1,
      }),
    );
    expect(events.findOne).toHaveBeenCalledWith({
      where: { id: 'event-1', organization_id: 'org-1', project_id: 4 },
    });
  });

  it('rejects unsupported changes and incomplete explanations', async () => {
    await expect(
      service.createPending(actor, 'org-1', 4, {
        eventId: 'event-1',
        proposedChanges: { secret: 'nope' } as any,
        reasons: { secret: 'Unsupported' },
        confidence: { secret: 0.5 },
        correlationId: 'audit-1',
        templateId: 'intake_suggestions',
        templateVersion: 1,
      }),
    ).rejects.toThrow('unsupported changes');

    await expect(
      service.createPending(actor, 'org-1', 4, {
        eventId: 'event-1',
        proposedChanges: { priority: 1 },
        reasons: {},
        confidence: { priority: 0.7 },
        correlationId: 'audit-1',
        templateId: 'intake_suggestions',
        templateVersion: 1,
      }),
    ).rejects.toThrow('A reason is required for priority');
  });

  it('dismisses only a pending tenant-scoped suggestion', async () => {
    suggestions.findOne.mockResolvedValue({
      id: 'suggestion-1',
      state: 'pending',
      organization_id: 'org-1',
      project_id: 4,
    });
    suggestions.update.mockResolvedValue({ affected: 1 });
    suggestions.findOneOrFail.mockResolvedValue({
      id: 'suggestion-1',
      state: 'dismissed',
    });

    await expect(
      service.dismiss(actor, 'org-1', 4, 'suggestion-1', 'Not relevant'),
    ).resolves.toEqual(expect.objectContaining({ state: 'dismissed' }));
    expect(suggestions.update).toHaveBeenCalledWith(
      { id: 'suggestion-1', state: 'pending' },
      expect.objectContaining({
        state: 'dismissed',
        reviewed_by_id: 7,
        review_note: 'Not relevant',
      }),
    );
    expect(audits.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AI_INTAKE_SUGGESTION_DISMISSED' }),
    );
  });

  it('rejects a concurrent second review decision', async () => {
    suggestions.findOne.mockResolvedValue({ id: 'suggestion-1', state: 'pending' });
    suggestions.update.mockResolvedValue({ affected: 0 });
    await expect(
      service.dismiss(actor, 'org-1', 4, 'suggestion-1'),
    ).rejects.toThrow('reviewed concurrently');
  });
});
