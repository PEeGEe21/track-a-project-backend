import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UserPeerStatus } from 'src/utils/constants/userPeerEnums';
import { Repository } from 'typeorm';

@Injectable()
export class SeederService {
  constructor(
    @InjectRepository(UserPeer)
    private readonly userPeerRepository: Repository<UserPeer>,
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
