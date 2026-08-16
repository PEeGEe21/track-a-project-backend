import { IntakeImportService } from './intake-import.service';
import * as ExcelJS from 'exceljs';

describe('IntakeImportService', () => {
  const authorization = { assertProjectPermission: jest.fn() };
  const ingestion = { processImportedRow: jest.fn() };
  const customFields = {
    prepareImportedValues: jest.fn(async (_o, _p, values) => values),
    list: jest.fn(async () => [
      {
        id: 'field-1',
        name: 'Environment',
        type: 'single_select',
        options: [{ key: 'production' }],
      },
    ]),
  };
  const batches = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'batch-1', ...value })),
    findOne: jest.fn(),
    remove: jest.fn(async (value) => value),
  };
  const rows = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(async (value) => value),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  let service: IntakeImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntakeImportService(
      authorization as any,
      ingestion as any,
      customFields as any,
      batches as any,
      rows as any,
    );
  });

  it('previews quoted CSV rows and persists stable row numbers', async () => {
    const result = await service.preview({ userId: 9 } as any, 'org-1', 7, {
      originalname: 'tasks.csv',
      mimetype: 'text/csv',
      size: 70,
      buffer: Buffer.from(
        'Title,Description\r\n"Build, failed","Line 1\nLine 2"\r\nFix tests,Today',
      ),
    } as any);

    expect(result).toEqual(
      expect.objectContaining({
        channel: 'csv',
        headers: ['Title', 'Description'],
        total_rows: 2,
        sampleRows: [
          { Title: 'Build, failed', Description: 'Line 1\nLine 2' },
          { Title: 'Fix tests', Description: 'Today' },
        ],
      }),
    );
    expect(rows.save).toHaveBeenCalledWith([
      expect.objectContaining({ row_number: 2 }),
      expect.objectContaining({ row_number: 3 }),
    ]);
  });

  it('generates CSV and Excel starter templates with active Custom Fields', async () => {
    const csv = await service.template({ userId: 9 } as any, 'org-1', 7, 'csv');
    expect(csv.filename).toBe('tailpoint-intake-template.csv');
    expect(csv.buffer.toString()).toContain('Custom: Environment [field-1]');
    expect(csv.buffer.toString()).toContain('production');
    expect(csv.buffer.toString()).toContain('Assignee Emails');

    const excel = await service.template(
      { userId: 9 } as any,
      'org-1',
      7,
      'xlsx',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excel.buffer as any);
    expect(workbook.getWorksheet('Tasks')?.getCell('G1').value).toBe(
      'Custom: Environment [field-1]',
    );
    expect(workbook.getWorksheet('Instructions')).toBeDefined();
  });

  it('removes a staged row and updates the batch total before processing', async () => {
    batches.findOne.mockResolvedValue({
      id: 'batch-1',
      organization_id: 'org-1',
      project_id: 7,
      state: 'previewed',
      total_rows: 3,
    });
    rows.findOne.mockResolvedValue({ id: 'row-2', batch_id: 'batch-1' });
    rows.count.mockResolvedValue(2);

    await expect(
      service.removeRow({ userId: 9 } as any, 'org-1', 7, 'batch-1', 'row-2'),
    ).resolves.toEqual({ removed: true, total_rows: 2 });
    expect(rows.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-2' }),
    );
    expect(batches.save).toHaveBeenCalledWith(
      expect.objectContaining({ total_rows: 2 }),
    );
  });

  it('clears an import batch without deleting its accepted tasks', async () => {
    const batch = {
      id: 'batch-1',
      organization_id: 'org-1',
      project_id: 7,
      state: 'completed',
      accepted_rows: 4,
    };
    batches.findOne.mockResolvedValue(batch);

    await expect(
      service.clear({ userId: 9 } as any, 'org-1', 7, 'batch-1'),
    ).resolves.toEqual({
      cleared: true,
      batch_id: 'batch-1',
      tasks_preserved: 4,
    });
    expect(batches.remove).toHaveBeenCalledWith(batch);
    expect(ingestion.processImportedRow).not.toHaveBeenCalled();
  });

  it('does not clear an import while it is processing', async () => {
    batches.findOne.mockResolvedValue({
      id: 'batch-1',
      organization_id: 'org-1',
      project_id: 7,
      state: 'processing',
    });

    await expect(
      service.clear({ userId: 9 } as any, 'org-1', 7, 'batch-1'),
    ).rejects.toThrow('cannot be cleared while it is processing');
    expect(batches.remove).not.toHaveBeenCalled();
  });

  it('rejects duplicate and blank headers before creating a batch', async () => {
    await expect(
      service.preview({ userId: 9 } as any, 'org-1', 7, {
        originalname: 'tasks.csv',
        mimetype: 'text/csv',
        size: 20,
        buffer: Buffer.from('Title,Title\nOne,Two'),
      } as any),
    ).rejects.toThrow('Import headers must be unique');
    expect(batches.save).not.toHaveBeenCalled();
  });

  it('detects the first Excel sheet and previews its rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tasks');
    sheet.addRow(['Title', 'Priority']);
    sheet.addRow(['Ship release', 2]);
    const buffer = await workbook.xlsx.writeBuffer();

    const result = await service.preview({ userId: 9 } as any, 'org-1', 7, {
      originalname: 'tasks.xlsx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.byteLength,
      buffer: Buffer.from(buffer),
    } as any);

    expect(result).toEqual(
      expect.objectContaining({
        channel: 'excel',
        sheet_name: 'Tasks',
        headers: ['Title', 'Priority'],
        sampleRows: [{ Title: 'Ship release', Priority: 2 }],
      }),
    );
  });

  it('accepts the documented 5,000-row bound and rejects row 5,001', async () => {
    const header = 'Title\n';
    const bounded =
      header +
      Array.from({ length: 5000 }, (_, index) => `Task ${index + 1}`).join(
        '\n',
      );
    await expect(
      service.preview({ userId: 9 } as any, 'org-1', 7, {
        originalname: 'large.csv',
        mimetype: 'text/csv',
        size: Buffer.byteLength(bounded),
        buffer: Buffer.from(bounded),
      } as any),
    ).resolves.toEqual(expect.objectContaining({ total_rows: 5000 }));

    const excessive = `${bounded}\nTask 5001`;
    await expect(
      service.preview({ userId: 9 } as any, 'org-1', 7, {
        originalname: 'too-large.csv',
        mimetype: 'text/csv',
        size: Buffer.byteLength(excessive),
        buffer: Buffer.from(excessive),
      } as any),
    ).rejects.toThrow('Imports cannot exceed 5000 rows');
  });

  it('produces a bounded CSV error report with escaped source values', async () => {
    batches.findOne.mockResolvedValue({
      id: 'batch-1',
      organization_id: 'org-1',
      project_id: 7,
      headers: ['Title'],
    });
    rows.find.mockResolvedValue([
      {
        row_number: 2,
        state: 'rejected',
        source_values: { Title: 'Bad, title' },
        error_code: 'validation_failed',
        error_message: 'Missing value',
      },
      { row_number: 3, state: 'accepted', source_values: { Title: 'Good' } },
    ]);
    const report = await service.errorReport(
      { userId: 9 } as any,
      'org-1',
      7,
      'batch-1',
    );
    expect(report).toContain('row,Title,error_code,error_message');
    expect(report).toContain('2,"Bad, title",validation_failed,Missing value');
    expect(report).not.toContain('Good');
  });
});
