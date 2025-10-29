import { Test, TestingModule } from '@nestjs/testing';
import { ProjectActivitiesService } from './project-activities.service';

describe('ProjectActivitiesService', () => {
  let service: ProjectActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectActivitiesService],
    }).compile();

    service = module.get<ProjectActivitiesService>(ProjectActivitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
