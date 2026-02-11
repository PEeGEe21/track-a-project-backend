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
} from '@nestjs/common';
import { NotesService } from '../services/notes.service';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';

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
    console.log(updateNoteDto, 'updateTaskDto');
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
  ) {
    return this.notesService.deleteNote(id, organizationId);
  }

  @Post('/')
  createNote(
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.notesService.createNote(payload, req.user, organizationId);
  }
}
