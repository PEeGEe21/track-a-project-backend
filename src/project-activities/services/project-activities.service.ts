import { Injectable } from '@nestjs/common';
import { CreateProjectActivityDto } from '../dto/create-project-activity.dto';
import { UpdateProjectActivityDto } from '../dto/update-project-activity.dto';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ActivityType } from 'src/utils/constants/activity';

@Injectable()
export class ProjectActivitiesService {
  constructor(
    @InjectRepository(ProjectActivity)
    private readonly activityRepository: Repository<ProjectActivity>,
  ) {}

  async createActivity(data: {
    organization_id: string;
    projectId: number;
    userId: number;
    activityType: ActivityType;
    description?: string;
    entityType?: string;
    entityId?: number;
    metadata?: Record<string, any>;
  }): Promise<ProjectActivity> {
    const activity = this.activityRepository.create(data);
    return await this.activityRepository.save(activity);
  }

  async getProjectActivities(
    projectId: number,
    limit: number = 50,
  ): Promise<ProjectActivity[]> {
    return await this.activityRepository.find({
      where: { projectId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUserActivitiesInProject(
    projectId: number,
    userId: number,
    limit: number = 50,
  ): Promise<ProjectActivity[]> {
    return await this.activityRepository.find({
      where: { projectId, userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getActivitiesInDateRange(
    projectId: number,
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<ProjectActivity[]> {
    return await this.activityRepository.find({
      where: {
        projectId,
        userId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getActivityCount(
    projectId: number,
    userId: number,
    activityType?: ActivityType,
  ): Promise<number> {
    const where: any = { projectId, userId };
    if (activityType) {
      where.activityType = activityType;
    }
    return await this.activityRepository.count({ where });
  }

  async getRecentActivitiesByType(
    projectId: number,
    activityType: ActivityType,
    limit: number = 10,
  ): Promise<ProjectActivity[]> {
    return await this.activityRepository.find({
      where: { projectId, activityType },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
