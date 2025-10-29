import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ProjectActivitiesService } from '../services/project-activities.service';
import { CreateProjectActivityDto } from '../dto/create-project-activity.dto';
import { UpdateProjectActivityDto } from '../dto/update-project-activity.dto';

@Controller('project-activities')
export class ProjectActivitiesController {
  constructor(
    private readonly projectActivitiesService: ProjectActivitiesService,
  ) {}

  // @Post()
  // create(@Body() createProjectActivityDto: CreateProjectActivityDto) {
  //   return this.projectActivitiesService.create(createProjectActivityDto);
  // }

  // @Get()
  // findAll() {
  //   return this.projectActivitiesService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.projectActivitiesService.findOne(+id);
  // }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateProjectActivityDto: UpdateProjectActivityDto,
  // ) {
  //   return this.projectActivitiesService.update(+id, updateProjectActivityDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.projectActivitiesService.remove(+id);
  // }
}
