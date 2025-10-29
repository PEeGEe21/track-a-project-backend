import { Test, TestingModule } from '@nestjs/testing';
import { ProjectActivitiesController } from './project-activities.controller';
import { ProjectActivitiesService } from '../services/project-activities.service';

describe('ProjectActivitiesController', () => {
  let controller: ProjectActivitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectActivitiesController],
      providers: [ProjectActivitiesService],
    }).compile();

    controller = module.get<ProjectActivitiesController>(
      ProjectActivitiesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
