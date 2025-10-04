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
} from '@nestjs/common';
import { NotesService } from '../services/notes.service';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('/')
  getUserProjectsQuery(
    @Req() req: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('task_id') task_id?: string,
  ) {
    return this.notesService.findUserNotes(
      req.user,
      page,
      limit,
      search,
      task_id,
    );
  }

  @Get(':id')
  getNote(@Param('id', ParseIntPipe) id: number) {
    return this.notesService.findNote(id);
  }

  @Put(':id')
  updateNoteById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: UpdateNoteDto,
  ) {
    return this.notesService.updateNote(id, updateTaskDto);
  }

  @Patch(':id/position')
  updateNotePositionById(
    @Param('id', ParseIntPipe) id: number,
    @Body('position') position: { x: number; y: number },
  ) {
    return this.notesService.updateNotePosition(id, position);
  }

  @Delete(':id')
  deleteNote(@Param('id', ParseIntPipe) id: number) {
    return this.notesService.deleteNote(id);
  }

  @Post('/')
  createNote(@Body() payload: any, @Req() req: any) {
    return this.notesService.createNote(payload, req.user);
  }
}
