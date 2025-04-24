import { Test, TestingModule } from '@nestjs/testing';
import { UserpeersController } from './userpeers.controller';
import { UserpeersService } from '../services/userpeers.service';

describe('UserpeersController', () => {
  let controller: UserpeersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserpeersController],
      providers: [UserpeersService],
    }).compile();

    controller = module.get<UserpeersController>(UserpeersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
