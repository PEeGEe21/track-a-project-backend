import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from '../services/tasks.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const builder = Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: {} }],
    });
    const module: TestingModule = await builder
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CapabilityGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
