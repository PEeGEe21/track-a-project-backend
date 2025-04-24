import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateUserpeerDto } from '../dto/create-userpeer.dto';
import { UpdateUserpeerDto } from '../dto/update-userpeer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from 'src/users/services/users.service';
import { UserPeer } from 'src/typeorm/entities/UserPeer';

@Injectable()
export class UserpeersService {
  constructor(
    // @InjectRepository(User) private userRepository: Repository<User>,
    // @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Project) private postRepository: Repository<Project>,
    @InjectRepository(UserPeer)
    private userPeerRepository: Repository<UserPeer>,
    // @InjectRepository(ProjectPeer)
    // private projectPeerRepository: Repository<ProjectPeer>,
    private userService: UsersService,
  ) {}

  create(createUserpeerDto: CreateUserpeerDto) {
    return 'This action adds a new userpeer';
  }

  async findUserPeers(
    user: any,
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<any> {
    try {

      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const queryBuilder = this.userPeerRepository
        .createQueryBuilder('user_peer')
        .leftJoinAndSelect('user_peer.user', 'user')
        .leftJoinAndSelect('user_peer.peer', 'peer')
        .where('user_peer.user_id = :id', { id: foundUser.id });

      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(
          `(LOWER(peer.first_name) LIKE :search OR LOWER(peer.last_name) LIKE :search OR LOWER(peer.email) LIKE :search)`,
          { search: lowered },
        );
      }

      queryBuilder.skip((page - 1) * limit).take(limit);

      const [result, total] = await queryBuilder.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      return {
        data: result,
        meta: {
          current_page: Number(page),
          from: (page - 1) * limit + 1,
          last_page: lastPage,
          per_page: Number(limit),
          to: (page - 1) * limit + result.length,
          total: total,
        },
        success: true
      };
    } catch (error) {
      console.error('Error fetching user peers:', error);
      throw new HttpException(
        'An error occurred while fetching user peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findUserPeers2(id: number, page = 1, limit = 10): Promise<any> {
    try {
      const user = await this.userService.getUserAccountById(id);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }
      console.log(user, 'user');

      const [result, total] = await this.userPeerRepository.findAndCount({
        where: { user: { id: user.id } }, // alternative if needed
        relations: ['user', 'peer'],
        skip: (page - 1) * limit,
        take: limit,
      });

      const lastPage = Math.ceil(total / limit);
      // const baseUrl = `https://yourdomain.com/api/user-peers?id=${id}`; // Adjust for your actual route

      return {
        succcess: true,
        data: result,
        // links: {
        //   first: `${baseUrl}&page=1`,
        //   last: `${baseUrl}&page=${lastPage}`,
        //   prev: page > 1 ? `${baseUrl}&page=${page - 1}` : null,
        //   next: page < lastPage ? `${baseUrl}&page=${page + 1}` : null,
        // },
        meta: {
          current_page: Number(page),
          from: (page - 1) * limit + 1,
          last_page: lastPage,
          // path: baseUrl.split('?')[0],
          per_page: limit,
          to: (page - 1) * limit + result.length,
          total: total,
        },
      };
    } catch (error) {
      console.error('Error fetching user peers:', error);
      throw new HttpException(
        'An error occurred while fetching user peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  findAll() {
    return `This action returns all userpeers`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userpeer`;
  }

  update(id: number, updateUserpeerDto: UpdateUserpeerDto) {
    return `This action updates a #${id} userpeer`;
  }

  remove(id: number) {
    return `This action removes a #${id} userpeer`;
  }
}
