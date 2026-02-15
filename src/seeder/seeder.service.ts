import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UserPeerStatus } from '../utils/constants/userPeerEnums';
import { Repository } from 'typeorm';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';
import { Organization } from 'src/typeorm/entities/Organization';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { OrganizationMenu } from 'src/typeorm/entities/OrganizationMenu';
import { GlobalMenu } from 'src/typeorm/entities/GlobalMenu';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/utils/constants/user_roles';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';

@Injectable()
export class SeederService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(UserPeer)
    private readonly userPeerRepository: Repository<UserPeer>,

    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(UserOrganization)
    private readonly userOrgRepo: Repository<UserOrganization>,

    @InjectRepository(OrganizationMenu)
    private readonly orgMenuRepo: Repository<OrganizationMenu>,
    @InjectRepository(GlobalMenu)
    private readonly globalMenuRepo: Repository<GlobalMenu>,
  ) {}

  //   async seedAdmin() {
  //     await this.userRepository.delete({});

  //     const users = [
  //       {
  //         fname: process.env.SUPER_FIRSTNAME,
  //         lname: process.env.SUPER_LASTNAME,
  //         username: process.env.SUPER_USERNAME,
  //         email: process.env.SUPER_EMAIL,
  //         password: process.env.SUPER_PASSWORD,
  //         cpassword: process.env.SUPER_PASSWORD,
  //         signup_as: Number(process.env.SUPER_SIGNUP),
  //       },
  //     ];

  //     for (const user of users) {
  //       const savedData = await this.authService.signUp(user);
  //       if (savedData.success == 'success') {
  //         const data = {
  //           success: 'success',
  //           message: 'User created successfully',
  //         };
  //         return data;
  //       }
  //     }

  //     console.log('Admin seeding completed');
  //   }

  async seedOrganizationsAndLinks() {
    // 1. Create a default organization
    let org = await this.orgRepo.findOne({ where: { slug: 'default-org' } });

    if (!org) {
      org = this.orgRepo.create({
        name: 'Default Organization',
        slug: 'default-org',
        subscription_tier: SubscriptionTier.FREE,
        max_users: 10,
        max_projects: 20,
        is_active: true,
      });
      await this.orgRepo.save(org);
      console.log('Default organization created');
    } else {
      console.log('Default organization already exists');
    }

    // 3. Enable all global menus for this organization
    const globalMenus = await this.globalMenuRepo.find();

    for (const globalMenu of globalMenus) {
      const existingOrgMenu = await this.orgMenuRepo.findOne({
        where: {
          organization: { id: org.id },
          global_menu: { id: globalMenu.id },
        },
      });

      if (!existingOrgMenu) {
        const orgMenu = this.orgMenuRepo.create({
          organization_id: org.id,
          global_menu_id: globalMenu.id,
          is_enabled: globalMenu.is_active, // Respect global is_active, or force true if you want
          custom_label: null,
          order_index: globalMenu.order_index,
        });
        await this.orgMenuRepo.save(orgMenu);
      }
    }

    console.log('Organization menus linked successfully');
  }

  async seedAdmin() {
    const existingAdmin = await this.userRepo.findOneBy({
      email: process.env.SUPER_EMAIL ?? 'admin@gmail.com',
    });
    if (!existingAdmin) {
      const first_name = process.env.SUPER_FIRSTNAME ?? 'Admin';
      const last_name = process.env.SUPER_LASTNAME ?? 'User';
      const username = process.env.SUPER_USERNAME ?? 'admin';
      const email = process.env.SUPER_EMAIL ?? 'admin@gmail.com';
      const password = process.env.SUPER_PASSWORD ?? 'password';

      const adminProfile = this.profileRepo.create({
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

      const savedAdminProfile = await this.profileRepo.save(adminProfile);

      await this.userRepo.save({
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

    const org = await this.orgRepo.findOne({ where: { slug: 'default-org' } });

    if (org) {
      for (let i = 0; i < 11; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const email = faker.internet
          .email({ firstName, lastName })
          .toLowerCase();

        /** Create profile first */
        const profile = this.profileRepo.create({
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

        const savedProfile = await this.profileRepo.save(profile);

        /** Create user and attach profile */
        const user = this.userRepo.create({
          first_name: firstName,
          last_name: lastName,
          username: savedProfile.username,
          email,
          password: await bcrypt.hash('password', 10),
          role: UserRole.MEMBER,
          is_active: true,
          profile: savedProfile,
        });

        await this.userRepo.save(user);

        const existing = await this.userOrgRepo.findOne({
          where: { organization: { id: org.id }, user: { id: user.id } },
        });

        if (!existing) {
          const userOrg = this.userOrgRepo.create({
            organization_id: org.id,
            user_id: user.id,
          });
          await this.userOrgRepo.save(userOrg);
          console.log(`User ${user.id} added to organization`);
        }
      }
    }
  }

  async seedUserPeers() {
    const userPeers = [
      {
        user: { id: 1 },
        peer: { id: 2 },
        status: UserPeerStatus.CONNECTED,
        notes: 'Known from school',
        is_confirmed: true,
        connection_type: '',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 3 },
        status: UserPeerStatus.CONNECTED,
        notes: 'Requested connection',
        is_confirmed: false,
        connection_type: '',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 4 },
        status: UserPeerStatus.CONNECTED,
        notes: 'Blocked due to spamming',
        is_confirmed: false,
        connection_type: '',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 5 },
        status: UserPeerStatus.BLOCKED,
        notes: 'Group project teammate',
        is_confirmed: true,
        connection_type: '',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 6 },
        status: UserPeerStatus.BLOCKED,
        notes: null,
        is_confirmed: true,
        connection_type: 'mentor',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 7 },
        status: UserPeerStatus.BLOCKED,
        notes: null,
        is_confirmed: true,
        connection_type: 'mentor',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 8 },
        status: UserPeerStatus.BLOCKED,
        notes: null,
        is_confirmed: true,
        connection_type: 'mentor',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 9 },
        status: UserPeerStatus.BLOCKED,
        notes: null,
        is_confirmed: true,
        connection_type: 'mentor',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 10 },
        status: UserPeerStatus.BLOCKED,
        notes: null,
        is_confirmed: true,
        connection_type: 'mentor',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 11 },
        status: UserPeerStatus.BLOCKED,
        notes: null,
        is_confirmed: true,
        connection_type: 'mentor',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user: { id: 1 },
        peer: { id: 12 },
        status: UserPeerStatus.BLOCKED,
        notes: null,
        is_confirmed: true,
        connection_type: 'mentor',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    // Check if the user already exist
    for (const user of userPeers) {
      //   const existingJournal = await this.userPeerRepository.findOne({
      //     where: { id: journal.id },
      //   });
      //   if (!existingJournal) {
      const newJournal = this.userPeerRepository.create(user);
      await this.userPeerRepository.save(newJournal);
      console.log(`user peer has been seeded`);
      //   }
    }

    console.log('Journals seeding completed');
  }

  //   async seedRoles() {
  //     const roles = [
  //       { id: 1, name: 'Admin' },
  //       { id: 2, name: 'Reader' },
  //       { id: 3, name: 'Author' },
  //       { id: 4, name: 'Editor' },
  //     ];

  //     // Check if the roles already exist
  //     for (const role of roles) {
  //       const existingRole = await this.roleRepository.findOne({ where: { id: role.id } });
  //       if (!existingRole) {
  //         const newRole = this.roleRepository.create(role);
  //         await this.roleRepository.save(newRole);
  //         console.log(`Role ${role.name} has been seeded`);
  //       }
  //     }

  //     console.log('Roles seeding completed');
  //   }
}
