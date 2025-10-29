import { Test, TestingModule } from '@nestjs/testing';
import { WhiteboardsController } from '../controllers/whiteboards.controller';
import { WhiteboardsService } from '../services/whiteboards.service';

describe('WhiteboardsController', () => {
  let controller: WhiteboardsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhiteboardsController],
      providers: [WhiteboardsService],
    }).compile();

    controller = module.get<WhiteboardsController>(WhiteboardsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
