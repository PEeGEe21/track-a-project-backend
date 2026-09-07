import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from '../services/resources.service';
import { SimplePreviewService } from '../../services/simple-preview.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization_access.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

describe('ResourcesController', () => {
  let controller: ResourcesController;

  beforeEach(async () => {
    const builder = Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [
        { provide: ResourcesService, useValue: {} },
        { provide: SimplePreviewService, useValue: {} },
      ],
    });
    const module: TestingModule = await builder
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ResourcesController>(ResourcesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
