import { DataSource } from 'typeorm';
import { User } from '../../typeorm/entities/User';
import { Project } from '../../typeorm/entities/Project';
import { Category } from '../../typeorm/entities/Category';
import { Tag } from '../../typeorm/entities/Tag';

const projectSeedData = [
  {
    title: 'Project Atlas',
    description: 'A knowledge management system for remote teams.',
    category: 'Work',
    color: '#4F46E5',
    icon: '📘',
  },
  {
    title: 'Mindful Me',
    description: 'A personal mindfulness and habit tracker.',
    category: 'Personal',
    color: '#10B981',
    icon: '🧘',
  },
  {
    title: 'CodeCademy Helper',
    description: 'An educational assistant platform for coders.',
    category: 'Education',
    color: '#F59E0B',
    icon: '💡',
  },
  {
    title: 'BudgetBuddy',
    description: 'A finance tracking and forecasting tool.',
    category: 'Finance',
    color: '#EF4444',
    icon: '💰',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  },
  {
    title: 'HealthPal',
    description: 'An all-in-one health and fitness dashboard.',
    category: 'Health',
    color: '#22D3EE',
    icon: '🏋️',
  }
];

export const seedProjects = async (dataSource: DataSource) => {
  const projectRepository = dataSource.getRepository(Project);
  const categoryRepository = dataSource.getRepository(Category);
  const tagRepository = dataSource.getRepository(Tag);

  const allCategories = await categoryRepository.find();
  const allTags = await tagRepository.find();

  // Optional: clear existing projects
  await projectRepository.delete({});

  for (const data of projectSeedData) {
    // const randomUserId = Math.floor(Math.random() * 3) + 1;
    const randomUserId = 3;


    // Random 1–2 categories
    const randomCategories = allCategories
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 2) + 1);

    // Random 1–3 tags
    const randomTags = allTags
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 1);

    const project = projectRepository.create({
      ...data,
      user: { id: randomUserId } as User,
      categories: randomCategories,
      tags: randomTags
    });

    await projectRepository.save(project);
  }

  console.log('Projects with categories and tags seeded successfully');
};
