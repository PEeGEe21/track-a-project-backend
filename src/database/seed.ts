// src/database/seed.ts
import { DataSource } from 'typeorm';
// import { seedCategories } from './seeds/category.seed';
// import { seedTags } from './seeds/tag.seed';
import { AppDataSource } from '../data-source';
// import { seedProjects } from './seeds/project.seed';
// import { seedUserPeers } from './seeds/userpeers.seed';
// import { seedProjectPeers } from './seeds/projectpeers.seed';
// import { seedUserNames } from './seeds/seedUserNames';


const runSeed = async () => {
  try {
    // Initialize the DataSource
    await AppDataSource.initialize();
    
    // Run seeders
    // await seedCategories(AppDataSource);
    // await seedTags(AppDataSource);
    // await seedProjects(AppDataSource);
    // await seedUserPeers(AppDataSource);
    // await seedProjectPeers(AppDataSource);
    // await seedUserNames(AppDataSource);
    
    console.log('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during database seeding:', error);
    process.exit(1);
  } finally {
    // Close the connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
};

// Run the seed function
runSeed();