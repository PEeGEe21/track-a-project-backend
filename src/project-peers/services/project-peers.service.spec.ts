import { Test, TestingModule } from '@nestjs/testing';
import { ProjectPeersService } from './project-peers.service';

describe('ProjectPeersService', () => {
  let service: ProjectPeersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectPeersService],
    }).compile();

    service = module.get<ProjectPeersService>(ProjectPeersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
