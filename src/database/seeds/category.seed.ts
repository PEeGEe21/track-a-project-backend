// src/database/seeds/category.seed.ts
import { Category } from '../../typeorm/entities/Category';
import { DataSource } from 'typeorm';

export const categorySeedData = [
  { name: 'Work', description: 'Work-related projects and tasks' },
  { name: 'Personal', description: 'Personal projects and activities' },
  { name: 'Education', description: 'Learning and educational initiatives' },
  { name: 'Health', description: 'Health and wellness related activities' },
  { name: 'Finance', description: 'Financial projects and tasks' },
  { name: 'Home', description: 'Home improvement and household tasks' },
  { name: 'Hobby', description: 'Hobby-related projects' },
  { name: 'Travel', description: 'Travel planning and trip management' }
];

export const seedCategories = async (dataSource: DataSource) => {
  const categoryRepository = dataSource.getRepository(Category);
  
  // Clear existing categories (optional)
  await categoryRepository.delete({});
  
  // Insert categories
  for (const category of categorySeedData) {
    await categoryRepository.save(categoryRepository.create(category));
  }
  
  console.log('Categories seeded successfully');
};