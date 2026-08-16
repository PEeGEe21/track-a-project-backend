import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { AuthUser } from 'src/types/users';
import { IntakeImportBatch } from 'src/typeorm/entities/IntakeImportBatch';
import { IntakeImportRow } from 'src/typeorm/entities/IntakeImportRow';
import { Repository } from 'typeorm';
import { ProcessIntakeImportDto } from '../dto/intake-import.dto';
import { IngestionService } from './ingestion.service';
import { CustomFieldsService } from 'src/custom-fields/custom-fields.service';

const MAX_IMPORT_ROWS = 5000;
const PREVIEW_ROWS = 20;

@Injectable()
export class IntakeImportService {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly ingestion: IngestionService,
    private readonly customFields: CustomFieldsService,
    @InjectRepository(IntakeImportBatch)
    private readonly batches: Repository<IntakeImportBatch>,
    @InjectRepository(IntakeImportRow)
    private readonly rows: Repository<IntakeImportRow>,
  ) {}

  async preview(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    file?: Express.Multer.File,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    if (!file?.buffer?.length)
      throw new BadRequestException('A CSV or Excel file is required');
    if (file.size > 10 * 1024 * 1024)
      throw new BadRequestException('Import files cannot exceed 10 MB');
    const parsed = await this.parse(file);
    if (!parsed.headers.length)
      throw new BadRequestException('The import has no headers');
    if (!parsed.rows.length)
      throw new BadRequestException('The import has no data rows');
    if (parsed.rows.length > MAX_IMPORT_ROWS)
      throw new BadRequestException(
        `Imports cannot exceed ${MAX_IMPORT_ROWS} rows`,
      );
    const batch = await this.batches.save(
      this.batches.create({
        organization_id: organizationId,
        project_id: projectId,
        created_by_id: actor.userId,
        channel: parsed.channel,
        original_name: file.originalname.slice(0, 255),
        sheet_name: parsed.sheetName,
        state: 'previewed',
        headers: parsed.headers,
        mapping: null,
        total_rows: parsed.rows.length,
        accepted_rows: 0,
        rejected_rows: 0,
        failed_rows: 0,
      }),
    );
    await this.rows.save(
      parsed.rows.map((values, index) =>
        this.rows.create({
          batch_id: batch.id,
          row_number: index + 2,
          source_values: values,
          state: 'pending',
          event_id: null,
          error_code: null,
          error_message: null,
        }),
      ),
    );
    return { ...batch, sampleRows: parsed.rows.slice(0, PREVIEW_ROWS) };
  }

  async get(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    batchId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const batch = await this.batches.findOne({
      where: {
        id: batchId,
        organization_id: organizationId,
        project_id: projectId,
      },
    });
    if (!batch) throw new NotFoundException('Import batch not found');
    return batch;
  }

  async list(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    options: { limit?: number; cursor?: string } = {},
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const limit = Math.min(100, Math.max(1, options.limit ?? 25));
    const position = this.decodeCursor(options.cursor);
    const query = this.batches
      .createQueryBuilder('batch')
      .where('batch.organization_id = :organizationId', { organizationId })
      .andWhere('batch.project_id = :projectId', { projectId });
    if (position)
      query.andWhere(
        '(batch.created_at < :cursorTime OR (batch.created_at = :cursorTime AND batch.id < :cursorId))',
        { cursorTime: position.createdAt, cursorId: position.id },
      );
    const rows = await query
      .orderBy('batch.created_at', 'DESC')
      .addOrderBy('batch.id', 'DESC')
      .take(limit + 1)
      .getMany();
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    return {
      data,
      meta: {
        limit,
        hasMore,
        nextCursor:
          hasMore && last ? this.encodeCursor(last.created_at, last.id) : null,
      },
    };
  }

  private encodeCursor(createdAt: Date, id: string) {
    return Buffer.from(`${createdAt.toISOString()}|${id}`).toString(
      'base64url',
    );
  }

  private decodeCursor(cursor?: string) {
    if (!cursor) return null;
    try {
      const [timestamp, id] = Buffer.from(cursor, 'base64url')
        .toString('utf8')
        .split('|');
      const createdAt = new Date(timestamp);
      if (!id || Number.isNaN(createdAt.getTime())) throw new Error();
      return { createdAt, id };
    } catch {
      throw new BadRequestException('Invalid import pagination cursor');
    }
  }

  async listRows(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    batchId: string,
  ) {
    const batch = await this.get(actor, organizationId, projectId, batchId);
    const rows = await this.rows.find({
      where: { batch_id: batch.id },
      order: { row_number: 'ASC' },
    });
    return { headers: batch.headers, total_rows: rows.length, rows };
  }

  async removeRow(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    batchId: string,
    rowId: string,
  ) {
    const batch = await this.get(actor, organizationId, projectId, batchId);
    if (batch.state !== 'previewed')
      throw new BadRequestException(
        'Rows can only be removed before an import is processed',
      );
    const row = await this.rows.findOne({
      where: { id: rowId, batch_id: batch.id },
    });
    if (!row) throw new NotFoundException('Import row not found');
    await this.rows.remove(row);
    batch.total_rows = await this.rows.count({
      where: { batch_id: batch.id },
    });
    await this.batches.save(batch);
    return { removed: true, total_rows: batch.total_rows };
  }

  async clear(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    batchId: string,
  ) {
    const batch = await this.get(actor, organizationId, projectId, batchId);
    if (batch.state === 'processing')
      throw new BadRequestException(
        'An import cannot be cleared while it is processing',
      );
    await this.batches.remove(batch);
    return {
      cleared: true,
      batch_id: batch.id,
      tasks_preserved: batch.accepted_rows,
    };
  }

  async template(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    format: 'csv' | 'xlsx',
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const fields = await this.customFields
      .list(actor, organizationId, projectId)
      .catch(() => []);
    const columns = [
      { header: 'Title', example: 'Investigate production alert' },
      {
        header: 'Description',
        example: 'The checkout error rate exceeded 5%.',
      },
      { header: 'Severity', example: 'high' },
      { header: 'Priority', example: 1 },
      { header: 'Dedupe Key', example: '' },
      { header: 'Assignee Emails', example: '' },
      ...fields.map((field) => ({
        header: `Custom: ${field.name} [${field.id}]`,
        example: this.customFieldExample(field.type, field.options ?? []),
      })),
    ];
    if (format === 'csv') {
      return {
        filename: 'tailpoint-intake-template.csv',
        mime: 'text/csv',
        buffer: Buffer.from(
          [
            columns.map((column) => this.csvCell(column.header)).join(','),
            columns.map((column) => this.csvCell(column.example)).join(','),
          ].join('\r\n'),
        ),
      };
    }
    const workbook = new ExcelJS.Workbook();
    const tasks = workbook.addWorksheet('Tasks');
    tasks.addRow(columns.map((column) => column.header));
    tasks.addRow(columns.map((column) => column.example));
    tasks.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    tasks.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B6E4F' },
    };
    tasks.columns.forEach((column) => {
      column.width = 28;
    });
    tasks.views = [{ state: 'frozen', ySplit: 1 }];
    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRows([
      ['Column', 'How to use it'],
      [
        'Title',
        'Required. Select this column as the task title during preview.',
      ],
      ['Description', 'Optional task description.'],
      ['Severity', 'Optional: low, medium, high, or critical.'],
      ['Priority', 'Optional whole number, zero or greater.'],
      [
        'Dedupe Key',
        'Optional stable identifier used to group repeated events into one task. Leave blank when every row should create a new task.',
      ],
      [
        'Assignee Emails',
        'Optional. Use project-member email addresses separated by commas or semicolons.',
      ],
      [
        'Custom Fields',
        'Map each Custom column to the matching field during preview. Select options use option keys; multi-select values are comma-separated.',
      ],
    ]);
    instructions.getRow(1).font = { bold: true };
    instructions.columns = [{ width: 24 }, { width: 90 }];
    return {
      filename: 'tailpoint-intake-template.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
  }

  async process(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    batchId: string,
    mapping: ProcessIntakeImportDto,
  ) {
    const batch = await this.get(actor, organizationId, projectId, batchId);
    if (batch.state === 'processing')
      throw new BadRequestException('Import batch is already processing');
    this.validateMapping(batch.headers, mapping);
    batch.state = 'processing';
    batch.mapping = mapping as unknown as Record<string, unknown>;
    await this.batches.save(batch);
    const rows = await this.rows.find({
      where: { batch_id: batch.id },
      order: { row_number: 'ASC' },
    });
    if (!rows.length)
      throw new BadRequestException('Keep at least one row before importing');
    for (const row of rows) {
      if (row.state === 'accepted') continue;
      try {
        const outcome = await this.ingestion.processImportedRow({
          organizationId,
          projectId,
          channel: batch.channel,
          sourceKey: `import:${batch.id}`,
          idempotencyKey: `row:${row.row_number}`,
          dto: await this.mapRow(
            organizationId,
            projectId,
            row.source_values,
            mapping,
          ),
        });
        row.event_id = outcome.event.id;
        row.state =
          outcome.event.state === 'accepted' ? 'accepted' : 'rejected';
        row.error_code = outcome.event.failure_code;
        row.error_message = outcome.event.failure_message;
      } catch (error) {
        row.state = this.statusOf(error) >= 500 ? 'failed' : 'rejected';
        row.error_code =
          row.state === 'failed' ? 'processing_failed' : 'validation_failed';
        row.error_message = (
          error instanceof Error ? error.message : 'Row processing failed'
        ).slice(0, 2000);
      }
      await this.rows.save(row);
    }
    const counts = await this.rows
      .createQueryBuilder('row')
      .select('row.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .where('row.batch_id = :batchId', { batchId })
      .groupBy('row.state')
      .getRawMany();
    const byState = new Map(
      counts.map((item) => [item.state, Number(item.count)]),
    );
    batch.accepted_rows = byState.get('accepted') ?? 0;
    batch.rejected_rows = byState.get('rejected') ?? 0;
    batch.failed_rows = byState.get('failed') ?? 0;
    batch.state = 'completed';
    return this.batches.save(batch);
  }

  async errorReport(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    batchId: string,
  ) {
    const batch = await this.get(actor, organizationId, projectId, batchId);
    const rows = await this.rows.find({
      where: { batch_id: batch.id },
      order: { row_number: 'ASC' },
    });
    const headers = ['row', ...batch.headers, 'error_code', 'error_message'];
    const lines = [headers.map(this.csvCell).join(',')];
    for (const row of rows.filter((item) => item.state !== 'accepted')) {
      lines.push(
        [
          row.row_number,
          ...batch.headers.map((header) => row.source_values[header] ?? ''),
          row.error_code ?? '',
          row.error_message ?? '',
        ]
          .map(this.csvCell)
          .join(','),
      );
    }
    return lines.join('\r\n');
  }

  private validateMapping(headers: string[], mapping: ProcessIntakeImportDto) {
    const columns = [
      mapping.title,
      mapping.description,
      mapping.severity,
      mapping.priority,
      mapping.dedupeKey,
      mapping.assignees,
      ...(mapping.customFields ?? []).map((item) => item.column),
    ].filter(Boolean) as string[];
    const unknown = columns.filter((column) => !headers.includes(column));
    if (unknown.length)
      throw new BadRequestException(
        `Unknown import columns: ${[...new Set(unknown)].join(', ')}`,
      );
    const fieldIds = (mapping.customFields ?? []).map((item) => item.fieldId);
    if (new Set(fieldIds).size !== fieldIds.length)
      throw new BadRequestException('Custom Field mappings must be unique');
  }

  private async mapRow(
    organizationId: string,
    projectId: number,
    values: Record<string, unknown>,
    mapping: ProcessIntakeImportDto,
  ) {
    const title = String(values[mapping.title] ?? '').trim();
    if (!title) throw new BadRequestException('Mapped title is required');
    const severity = mapping.severity
      ? String(values[mapping.severity] ?? '')
          .trim()
          .toLowerCase()
      : undefined;
    if (severity && !['low', 'medium', 'high', 'critical'].includes(severity))
      throw new BadRequestException(`Invalid severity: ${severity}`);
    const rawPriority = mapping.priority ? values[mapping.priority] : undefined;
    const priority =
      rawPriority === undefined || rawPriority === ''
        ? undefined
        : Number(rawPriority);
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0))
      throw new BadRequestException(`Invalid priority: ${String(rawPriority)}`);
    return {
      source: 'manual' as const,
      title,
      description: mapping.description
        ? String(values[mapping.description] ?? '')
        : undefined,
      severity: severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
      priority,
      dedupeKey: mapping.dedupeKey
        ? String(values[mapping.dedupeKey] ?? '').trim() || undefined
        : undefined,
      assigneeEmails: mapping.assignees
        ? this.parseAssigneeEmails(values[mapping.assignees])
        : undefined,
      customFields: await this.customFields.prepareImportedValues(
        organizationId,
        projectId,
        (mapping.customFields ?? []).map((item) => ({
          fieldId: item.fieldId,
          value: values[item.column] ?? null,
        })),
      ),
    };
  }

  private parseAssigneeEmails(value: unknown) {
    const emails = [
      ...new Set(
        String(value ?? '')
          .split(/[;,]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (emails.length > 50)
      throw new BadRequestException('A row cannot have more than 50 assignees');
    const invalid = emails.filter(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    );
    if (invalid.length)
      throw new BadRequestException(`Invalid assignee email: ${invalid[0]}`);
    return emails.length ? emails : undefined;
  }

  private async parse(file: Express.Multer.File) {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.csv') || file.mimetype === 'text/csv') {
      const matrix = this.parseCsv(file.buffer.toString('utf8'));
      return {
        channel: 'csv' as const,
        sheetName: null,
        ...this.matrixToRows(matrix),
      };
    }
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls'))
      throw new BadRequestException('Only CSV and Excel files are supported');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The workbook has no worksheets');
    const matrix: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) =>
      matrix.push(
        (row.values as unknown[])
          .slice(1)
          .map((value: any) => value?.text ?? value?.result ?? value ?? ''),
      ),
    );
    return {
      channel: 'excel' as const,
      sheetName: sheet.name.slice(0, 120),
      ...this.matrixToRows(matrix),
    };
  }

  private matrixToRows(matrix: unknown[][]) {
    const headers = (matrix[0] ?? []).map((value) => String(value).trim());
    if (headers.some((header) => !header))
      throw new BadRequestException('Every import column must have a header');
    if (new Set(headers).size !== headers.length)
      throw new BadRequestException('Import headers must be unique');
    const rows = matrix
      .slice(1)
      .filter((row) => row.some((value) => String(value ?? '').trim()))
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, row[index] ?? '']),
        ),
      );
    return { headers, rows };
  }

  private parseCsv(input: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;
    const text = input.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted && char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(value);
        if (row.some((cell) => cell.length)) rows.push(row);
        row = [];
        value = '';
      } else value += char;
    }
    if (quoted)
      throw new BadRequestException(
        'CSV contains an unterminated quoted value',
      );
    row.push(value);
    if (row.some((cell) => cell.length)) rows.push(row);
    return rows;
  }

  private statusOf(error: unknown) {
    return typeof (error as any)?.getStatus === 'function'
      ? (error as any).getStatus()
      : 500;
  }
  private customFieldExample(type: string, options: any[]) {
    if (type === 'number') return 10;
    if (type === 'checkbox') return true;
    if (type === 'date') return '2026-08-31';
    if (type === 'url') return 'https://example.com/context';
    if (type === 'person') return 1;
    if (type === 'single_select') return options[0]?.key ?? 'option-key';
    if (type === 'multi_select')
      return options
        .slice(0, 2)
        .map((option) => option.key)
        .join(',');
    return 'Example value';
  }
  private csvCell(value: unknown) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
