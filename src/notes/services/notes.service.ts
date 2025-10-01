import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import { Task } from 'src/typeorm/entities/Task';
import { CreateNoteDto } from '../dto/create-note.dto';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { UsersService } from 'src/users/services/users.service';
import { Note } from 'src/typeorm/entities/Note';

@Injectable()
export class NotesService {
  constructor(
    private usersService: UsersService,

    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Note) private noteRepository: Repository<Note>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
  ) {}

  async findUserNotes(
    user: any,
    page: number = 1,
    limit: number = 10,
    search?: string,
    task_id?: string,
  ): Promise<any> {
    try {
      // 1. Await the user search result
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // 2. Use the query builder
      const queryBuilder = this.noteRepository.createQueryBuilder('note');

      // 1. Select project fields (all fields by default)
      queryBuilder.select('note');

      // 2. Join owner (exclude sensitive fields)
      queryBuilder
        .leftJoin('note.user', 'owner')
        .addSelect([
          'owner.id',
          'owner.first_name',
          'owner.last_name',
          'owner.email',
          'owner.avatar',
        ]);

      // 3. Join tasks (fully)
      queryBuilder.leftJoinAndSelect('note.tasks', 'tasks');

      // 4. Apply group conditions cleanly
      queryBuilder.where('owner.id = :userId', { userId: userFound.id });

      if (task_id) {
        queryBuilder.andWhere('tasks.id = :taskId', { taskId: task_id });
      }

      // 5. Search filter
      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(`(LOWER(note.note) LIKE :search)`, {
          search: lowered,
        });
      }

      // 8. Pagination and ordering
      queryBuilder.skip((page - 1) * limit);
      queryBuilder.take(limit);
      // queryBuilder.orderBy('project.created_at', 'DESC');

      // 9. Execute query
      const [result, total] = await queryBuilder.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      return {
        data: result,
        meta: {
          current_page: Number(page),
          from: (page - 1) * limit + 1,
          last_page: lastPage,
          per_page: Number(limit),
          to: (page - 1) * limit + result.length,
          total: total,
        },
        success: 'success',
      };
    } catch (error) {
      console.error('Error fetching user notes:', error);
      throw new HttpException(
        'Error fetching user notes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateNote(id: number, updateTaskDetails: UpdateNoteDto) {
    try {
      const note = await this.noteRepository.findOneBy({ id });
      if (!note)
        throw new HttpException('Note not found', HttpStatus.BAD_REQUEST);

      console.log(note, updateTaskDetails, 'task');
      const data = {
        note: updateTaskDetails.note,
      };

      if (updateTaskDetails.taskId) {
        const taskCheck = await this.taskRepository.findOneBy({
          id: updateTaskDetails.taskId,
        });
        if (!taskCheck)
          throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
        data['task'] = { id: updateTaskDetails.taskId };
      }

      const updatedResult = await this.noteRepository.update(
        { id },
        { ...data },
      );

      console.log(updatedResult, 'rererr');

      if (updatedResult.affected < 1) {
        return {
          error: 'error',
          message: 'Note update failed',
        };
      }

      const updatedNote = await this.noteRepository.findOne({
        where: { id },
        relations: ['status', 'project'],
      });

      return {
        success: 'success',
        message: 'Task updated successfully',
        data: updatedNote,
      };
    } catch (error) {}
  }

  async findNote(id: number): Promise<any> {
    try {
      const note = await this.noteRepository.findOne({
        where: { id: id },
      });

      if (!note) {
        // throw new HttpException('Status doesnt exist', HttpStatus.INTERNAL_SERVER_ERROR);
        return { error: 'error', message: 'Note not found' }; // Or throw a NotFoundException
      }
      return { success: 'success', note: note };
    } catch (err) {
      console.error('Error deleting Note:', err);
      throw new HttpException(
        'Error deleting Note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteNote(id: number): Promise<any> {
    try {
      const note = await this.noteRepository.findOne({
        where: { id: id },
      });

      if (!note) {
        // throw new HttpException('Status doesnt exist', HttpStatus.INTERNAL_SERVER_ERROR);
        return { error: 'error', message: 'Note not found' }; // Or throw a NotFoundException
      }

      await this.noteRepository.delete(id);

      return { success: 'success', message: 'Note deleted successfully' };
    } catch (err) {
      console.error('Error deleting Note:', err);
      throw new HttpException(
        'Error deleting Note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createNote(payload: any, user): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const { note, taskId } = payload.payload;

      if (taskId) {
        const task = await this.taskRepository.findOne({
          where: { id: taskId },
        });
        if (!task)
          return {
            error: 'error',
            message: 'Task not found',
          };
      }
      // throw new HttpException(
      //   'Project not found. Cannot create Task',
      //   HttpStatus.BAD_REQUEST,
      // );

      var newPayload = {
        note,
      };

      if (taskId) {
        newPayload['task'] = taskId;
      }
      const newNote = this.noteRepository.create(newPayload);

      // return
      const savedNote = await this.noteRepository.save(newNote);

      return {
        success: 'success',
        message: 'Note created successfully',
        data: savedNote,
      };
    } catch (err) {
      console.error('Error saving Note:', err);
      throw new HttpException(
        'Error saving Note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
