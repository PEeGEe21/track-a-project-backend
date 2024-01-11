import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import {
  CreateUserParams,
  CreateUserPostParams,
  CreateUserProfileParams,
  UpdateUserParams,
} from '../../utils/types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Post) private postRepository: Repository<Post>,
  ) {}

  async getUserAccountById(id: string): Promise<User | undefined> {
    const user = await this.userRepository.findOneBy({ id });

    console.log(user);
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    }

    return user;
  }

  async getUserAccountByEmail(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    }
    return user;
  }

  // async getUserAccountByPhoneNumber(
  //   phoneNumber: string,
  // ): Promise<UserAccountDocument> {
  //   return this.UserAccountModel.findOne({ phoneNumber }).lean();
  // }

  // async getUserAccountPassword(email: string): Promise<string> {
  //   return (
  //     await this.userRepository.findBy({ email }, { password: 1 }).exec()
  //   ).password;
  // }

  async getUserAccountPassword(email: string): Promise<string | undefined> {
    const user = await this.userRepository.findOneBy({ email });
    return user?.password;
  }

  findUsers() {
    return this.userRepository.find({ relations: ['profile', 'posts'] });
  }

  createUser(userDetails: CreateUserParams) {
    const newUser = this.userRepository.create({
      ...userDetails,
      createdAt: new Date(),
    });
    return this.userRepository.save(newUser);
  }

  updateUser(id: string, updateUserDetails: UpdateUserParams) {
    return this.userRepository.update({ id }, { ...updateUserDetails });
  }

  deleteUser(id: string) {
    return this.userRepository.delete({ id });
  }

  async createUserProfile(
    id: string,
    createUserProfileDetails: CreateUserProfileParams,
  ) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user)
      throw new HttpException(
        'User not found. Cannot create Profile',
        HttpStatus.BAD_REQUEST,
      );
    const newProfile = this.profileRepository.create(createUserProfileDetails);
    const savedProfile = await this.profileRepository.save(newProfile);
    user.profile = savedProfile;
    return this.userRepository.save(user);
  }

  async checkUserAccountEmailExists(email: string): Promise<boolean> {
    const user = await this.getUserAccountByEmail(email);
    if (user) return true;
    return false;
  }

  async getRandomString(length: number): Promise<any> {
    const randomChars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += randomChars.charAt(
        Math.floor(Math.random() * randomChars.length),
      );
    }
    return result;
  }
}
