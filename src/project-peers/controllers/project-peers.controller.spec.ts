import { Test, TestingModule } from '@nestjs/testing';
import { ProjectPeersController } from './project-peers.controller';

describe('ProjectPeersController', () => {
  let controller: ProjectPeersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectPeersController],
    }).compile();

    controller = module.get<ProjectPeersController>(ProjectPeersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
