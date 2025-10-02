// src/database/seeds/status.seed.ts
import { Status } from '../../typeorm/entities/Status';
import { User } from '../../typeorm/entities/User';
import { DataSource } from 'typeorm';

export const statusSeedData = [
  {
    title: 'Ongoing',
    color: '#FF4D4D',
    description: 'Needs immediate attention',
    tabId: 1,
  },
  {
    title: 'Important',
    color: '#FFD700',
    description: 'High priority but not urgent',
    tabId: 2,
  },
  {
    title: 'Quick Win',
    color: '#32CD32',
    description: 'Can be completed quickly',
    tabId: 3,
  },
  {
    title: 'In Progress',
    color: '#1E90FF',
    description: 'Currently being worked on',
    tabId: 4,
  },
  {
    title: 'Blocked',
    color: '#8B0000',
    description: 'Cannot proceed due to dependencies',
    tabId: 5,
  },
  {
    title: 'Low Priority',
    color: '#A9A9A9',
    description: 'Can be addressed later',
    tabId: 6,
  },
  {
    title: 'Meeting',
    color: '#9370DB',
    description: 'Requires a meeting discussion',
    tabId: 7,
  },
  {
    title: 'Research',
    color: '#20B2AA',
    description: 'Requires investigation',
    tabId: 8,
  },
  {
    title: 'Documentation',
    color: '#FF8C00',
    description: 'Related to documentation',
    tabId: 9,
  },
  {
    title: 'Bug',
    color: '#DC143C',
    description: 'Issue that needs fixing',
    tabId: 10,
  },
  {
    title: 'Feature',
    color: '#4169E1',
    description: 'New feature development',
    tabId: 11,
  },
  {
    title: 'Improvement',
    color: '#3CB371',
    description: 'Enhancement to existing functionality',
    tabId: 12,
  },
  {
    title: 'Personal',
    color: '#9932CC',
    description: 'Personal tasks and activities',
    tabId: 13,
  },
  {
    title: 'Weekend',
    color: '#FF1493',
    description: 'Tasks for weekend',
    tabId: 14,
  },
  {
    title: 'Planning',
    color: '#708090',
    description: 'Planning related activities',
    tabId: 15,
  },
];

export const seedStatus = async (dataSource: DataSource) => {
  const statusRepository = dataSource.getRepository(Status);
  const userRepo = dataSource.getRepository(User);

  const users = await userRepo.find();
  if (users.length === 0) {
    throw new Error('No users found. Seed users first!');
  }
  // Clear existing statuses (optional)
  await statusRepository.delete({});

  for (const status of statusSeedData) {
    const randomUser = users[Math.floor(Math.random() * users.length)];

    await statusRepository.save({
      ...status,
      user: randomUser,
      isActive: true, // default active
    });
  }

  console.log('Statuses seeded successfully');
};
