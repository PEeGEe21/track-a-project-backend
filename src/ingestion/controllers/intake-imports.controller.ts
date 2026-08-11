import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { ProcessIntakeImportDto } from '../dto/intake-import.dto';
import { IntakeImportService } from '../services/intake-import.service';

@Controller('projects/:projectId/intake/imports')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.UNIVERSAL_INTAKE)
export class IntakeImportsController {
  constructor(private readonly imports: IntakeImportService) {}

  @Get()
  list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.imports.list(req.user, org, projectId);
  }

  @Get('template')
  async template(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('format') requestedFormat: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const format = requestedFormat === 'xlsx' ? 'xlsx' : 'csv';
    const template = await this.imports.template(
      req.user,
      org,
      projectId,
      format,
    );
    response.type(template.mime);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${template.filename}"`,
    );
    return new StreamableFile(template.buffer);
  }

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  preview(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.imports.preview(req.user, org, projectId, file);
  }

  @Get(':batchId')
  get(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.imports.get(req.user, org, projectId, batchId);
  }

  @Get(':batchId/rows')
  rows(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.imports.listRows(req.user, org, projectId, batchId);
  }

  @Delete(':batchId/rows/:rowId')
  removeRow(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
  ) {
    return this.imports.removeRow(req.user, org, projectId, batchId, rowId);
  }

  @Post(':batchId/process')
  process(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() mapping: ProcessIntakeImportDto,
  ) {
    return this.imports.process(req.user, org, projectId, batchId, mapping);
  }

  @Get(':batchId/errors.csv')
  async errors(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const report = await this.imports.errorReport(
      req.user,
      org,
      projectId,
      batchId,
    );
    response.type('text/csv');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="intake-import-${batchId}-errors.csv"`,
    );
    return report;
  }
}
