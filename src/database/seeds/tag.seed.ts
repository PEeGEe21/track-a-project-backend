// src/database/seeds/tag.seed.ts
import { Tag } from '../../typeorm/entities/Tag';
import { DataSource } from 'typeorm';

export const tagSeedData = [
  {
    name: 'urgent',
    color: '#FF4D4D',
    description: 'Needs immediate attention',
  },
  {
    name: 'important',
    color: '#FFD700',
    description: 'High priority but not urgent',
  },
  {
    name: 'quick-win',
    color: '#32CD32',
    description: 'Can be completed quickly',
  },
  {
    name: 'in-progress',
    color: '#1E90FF',
    description: 'Currently being worked on',
  },
  {
    name: 'blocked',
    color: '#8B0000',
    description: 'Cannot proceed due to dependencies',
  },
  {
    name: 'low-priority',
    color: '#A9A9A9',
    description: 'Can be addressed later',
  },
  {
    name: 'meeting',
    color: '#9370DB',
    description: 'Requires a meeting discussion',
  },
  { name: 'research', color: '#20B2AA', description: 'Requires investigation' },
  {
    name: 'documentation',
    color: '#FF8C00',
    description: 'Related to documentation',
  },
  { name: 'bug', color: '#DC143C', description: 'Issue that needs fixing' },
  { name: 'feature', color: '#4169E1', description: 'New feature development' },
  {
    name: 'improvement',
    color: '#3CB371',
    description: 'Enhancement to existing functionality',
  },
  {
    name: 'personal',
    color: '#9932CC',
    description: 'Personal tasks and activities',
  },
  { name: 'weekend', color: '#FF1493', description: 'Tasks for weekend' },
  {
    name: 'planning',
    color: '#708090',
    description: 'Planning related activities',
  },
];

export const seedTags = async (dataSource: DataSource) => {
  const tagRepository = dataSource.getRepository(Tag);

  // Clear existing tags (optional)
  await tagRepository.delete({});

  // Insert tags
  for (const tag of tagSeedData) {
    await tagRepository.save(tagRepository.create(tag));
  }

  console.log('Tags seeded successfully');
};
