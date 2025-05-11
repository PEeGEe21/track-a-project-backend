// seed-user-names.ts
import { DataSource } from 'typeorm';
import { User } from '../../typeorm/entities/User';
// import Chance from 'chance';
import { faker } from '@faker-js/faker';

// const chance = Chance(); // ✅ no "new"

// Main seeder function
export const seedUserNames = async (dataSource: DataSource) => {
  const userRepository = dataSource.getRepository(User);

  try {
    console.log('Starting name seeding process...');

    // Find all users without first_name or last_name
    const usersWithoutNames = await userRepository.find({
      where: [
        { first_name: null },
        { first_name: '' },
        { last_name: null },
        { last_name: '' },
      ],
    });

    console.log(
      `Found ${usersWithoutNames.length} users without complete names`,
    );

    // Update each user with random names
    let updateCount = 0;

    for (const user of usersWithoutNames) {
      // Only update fields that are empty or null
      const updates: Partial<User> = {};

      if (!user.first_name) {
        updates.first_name = faker.person.firstName();
        // updates.first_name = chance.first();
      }

      if (!user.last_name) {
        updates.last_name = faker.person.lastName();
        // updates.last_name = chance.last();
      }

      // Skip if no updates needed
      if (Object.keys(updates).length === 0) {
        continue;
      }

      // Update user
      await userRepository.update(user.id, updates);
      updateCount++;

      // Log progress every 100 users
      if (updateCount % 100 === 0) {
        console.log(`Updated ${updateCount} users so far...`);
      }
    }

    console.log(
      `Seeding complete! Updated ${updateCount} users with random names.`,
    );
  } catch (error) {
    console.error('Error seeding user names:', error);
  }
};
