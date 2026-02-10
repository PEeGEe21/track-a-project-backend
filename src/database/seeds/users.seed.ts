import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { User } from '../../typeorm/entities/User';
import { Profile } from '../../typeorm/entities/Profile';
import { UserRole } from '../../utils/constants/user_roles';
import { Organization } from '../../typeorm/entities/Organization';
import { UserOrganization } from '../../typeorm/entities/UserOrganization';

export async function seedUsers(dataSource: DataSource, count = 20) {
  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(Profile);
  const orgRepo = dataSource.getRepository(Organization);
  const userOrgRepo = dataSource.getRepository(UserOrganization);

  const existingAdmin = await userRepo.findOneBy({
    email: process.env.SUPER_EMAIL ?? 'admin@example.com',
  });
  if (!existingAdmin) {
    let first_name = process.env.SUPER_FIRSTNAME ?? 'Admin';
    let last_name = process.env.SUPER_LASTNAME ?? 'User';
    let username = process.env.SUPER_USERNAME ?? 'admin';
    let email = process.env.SUPER_EMAIL ?? 'admin@example.com';
    let password = process.env.SUPER_PASSWORD ?? 'password';

    const adminProfile = profileRepo.create({
      firstname: first_name,
      lastname: last_name,
      username: username,
      email: email,
      phonenumber: '08000000000',
      country: 'Nigeria',
      state: 'FCT',
      address: 'Abuja',
      profile_created: 1,
    });

    const savedAdminProfile = await profileRepo.save(adminProfile);

    await userRepo.save({
      first_name: first_name,
      last_name: last_name,
      username: username,
      email: email,
      password: await bcrypt.hash(password, 10),
      role: UserRole.SUPER_ADMIN,
      is_active: true,
      profile: savedAdminProfile,
    });
  }

  const org = await orgRepo.findOne({ where: { slug: 'default-org' } });

  if (org) {
    for (let i = 0; i < count; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName }).toLowerCase();

      /** Create profile first */
      const profile = profileRepo.create({
        firstname: firstName,
        lastname: lastName,
        username: faker.internet.username({ firstName, lastName }),
        email,
        phonenumber: faker.phone.number(),
        country: faker.location.country(),
        state: faker.location.state(),
        address: faker.location.streetAddress(),
        profile_created: 1,
      });

      const savedProfile = await profileRepo.save(profile);

      /** Create user and attach profile */
      const user = userRepo.create({
        first_name: firstName,
        last_name: lastName,
        username: savedProfile.username,
        email,
        password: await bcrypt.hash('password', 10),
        role: UserRole.MEMBER,
        is_active: true,
        profile: savedProfile,
      });

      await userRepo.save(user);

      const existing = await userOrgRepo.findOne({
        where: { organization: { id: org.id }, user: { id: user.id } },
      });

      if (!existing) {
        const userOrg = userOrgRepo.create({
          organization_id: org.id,
          user_id: user.id,
        });
        await userOrgRepo.save(userOrg);
        console.log(`User ${user.id} added to organization`);
      }
    }
  }

  console.log(`Seeded ${count} users with profiles`);
}
