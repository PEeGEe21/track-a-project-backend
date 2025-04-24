import { Test, TestingModule } from '@nestjs/testing';
import { UserpeersService } from './userpeers.service';

describe('UserpeersService', () => {
  let service: UserpeersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserpeersService],
    }).compile();

    service = module.get<UserpeersService>(UserpeersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
