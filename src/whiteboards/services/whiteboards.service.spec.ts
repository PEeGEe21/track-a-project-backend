import { Test, TestingModule } from '@nestjs/testing';
import { WhiteboardsService } from './whiteboards.service';

describe('WhiteboardsService', () => {
  let service: WhiteboardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhiteboardsService],
    }).compile();

    service = module.get<WhiteboardsService>(WhiteboardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
