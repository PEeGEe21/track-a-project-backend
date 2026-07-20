import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  Req,
  UseGuards,
  Query,
  Patch,
  Headers,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { NotesService } from '../services/notes.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadNoteAudioDto } from '../dto/upload-note-audio.dto';

@UseGuards(JwtAuthGuard, OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('/')
  getUserNotesQuery(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('task_id') task_id?: string,
  ) {
    return this.notesService.findUserNotes(
      req.user,
      organizationId,
      page,
      limit,
      search,
      task_id,
    );
  }

  @Get(':id')
  getNote(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notesService.findNote(id, organizationId);
  }

  @Put(':id')
  updateNoteById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateNoteDto: any,
  ) {
    return this.notesService.updateNote(id, updateNoteDto);
  }

  @Patch(':id/position')
  updateNotePositionById(
    @Param('id', ParseIntPipe) id: number,
    @Body('position') position: { x: number; y: number },
  ) {
    return this.notesService.updateNotePosition(id, position);
  }

  @Patch(':id/order')
  updateNoteOrderById(
    @Param('id', ParseIntPipe) id: number,
    @Body('order') order: number | string,
  ) {
    return this.notesService.updateNoteOrder(id, order);
  }

  @Delete(':id')
  deleteNote(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-organization-id') organizationId: string,
    @Req() req: any,
  ) {
    return this.notesService.deleteNote(id, organizationId, req.user);
  }

  @Post('/')
  createNote(
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notesService.createNote(payload, req.user, organizationId);
  }

  @Post(':id/audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  uploadNoteAudio(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Body() body?: UploadNoteAudioDto,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    return this.notesService.uploadNoteAudio(
      id,
      file,
      req.user,
      organizationId,
      body?.durationSeconds,
      body?.transcript,
      body?.recordingConsent,
      body?.noticeVersion,
    );
  }

  @Post(':id/transcribe')
  requestNoteTranscription(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notesService.requestAudioTranscription(
      id,
      req.user,
      organizationId,
    );
  }

  @Get(':id/audio/export')
  exportAudio(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notesService.exportAudio(id, req.user, organizationId);
  }

  @Get(':id/audio/access-history')
  audioAccessHistory(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notesService.audioAccessHistory(id, req.user, organizationId);
  }

  @Delete(':id/audio')
  deleteAudio(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notesService.deleteAudio(id, req.user, organizationId);
  }
}
