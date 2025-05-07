import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateUserpeerDto } from '../dto/create-userpeer.dto';
import { UpdateUserpeerDto } from '../dto/update-userpeer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from 'src/users/services/users.service';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserPeerStatusInviteType } from 'src/utils/constants/userPeerEnums';

@Injectable()
export class UserpeersService {
  constructor(
    // @InjectRepository(User) private userRepository: Repository<User>,
    // @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Project) private postRepository: Repository<Project>,
    @InjectRepository(UserPeer)
    private userPeerRepository: Repository<UserPeer>,
    @InjectRepository(UserPeerInvite)
    private userPeerInvitesRepository: Repository<UserPeerInvite>,
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
        success: true,
      };
    } catch (error) {
      console.error('Error fetching user peers:', error);
      throw new HttpException(
        'An error occurred while fetching user peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findUserPeersInvite(
    user: any,
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
  ): Promise<any> {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const queryBuilder = this.userPeerInvitesRepository
        .createQueryBuilder('user_peer_invites')
        .leftJoinAndSelect('user_peer_invites.inviter_user_id', 'inviter');

      queryBuilder.where('user_peer_invites.email = :email', {
        email: foundUser.email,
      });
      queryBuilder.orderBy('user_peer_invites.created_at', 'DESC'); // <-- new line

      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(
          `(LOWER(inviter.first_name) LIKE :search OR LOWER(inviter.last_name) LIKE :search OR LOWER(inviter.email) LIKE :search)`,
          { search: lowered },
        );
      }

      // Handle status
      if (status && status !== 'all') {
        const loweredStatus = status.toLowerCase();
        queryBuilder.andWhere(
          `LOWER(user_peer_invites.status) = :status`, // assuming you have a `status` column
          { status: loweredStatus },
        );
      }

      queryBuilder.skip((page - 1) * limit).take(limit);

      const [result, total] = await queryBuilder.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      const pendingInvites = await this.countPendingPeerInvites(foundUser);
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
        pending_invites: pendingInvites,
        success: true,
      };
    } catch (error) {
      console.error('Error fetching user peers:', error);
      throw new HttpException(
        'An error occurred while fetching user peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findUserPeersSentInvite(
    user: any,
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
  ): Promise<any> {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const queryBuilder = this.userPeerInvitesRepository
        .createQueryBuilder('user_peer_invites')
        .leftJoinAndSelect('user_peer_invites.inviter_user_id', 'inviter');

      queryBuilder.where('user_peer_invites.inviter_user_id = :id', {
        id: foundUser.id,
      });
      // <-- key line
      // queryBuilder.where('user_peer_invites.inviter_user_id.user.id = :id', {
      //   id: foundUser.id,
      // }); // <-- key line
      queryBuilder.orderBy('user_peer_invites.created_at', 'DESC'); // <-- new line

      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(`LOWER(user_peer_invites.email) LIKE :search`, {
          search: lowered,
        });
        // queryBuilder.andWhere(
        //   `(LOWER(user_peer_invites.email) LIKE :search OR LOWER(user.first_name) LIKE :search OR LOWER(user.last_name) LIKE :search)`,
        //   { search: lowered },
        // );
      }

      // Handle status
      if (status && status !== 'all') {
        const loweredStatus = status.toLowerCase();
        queryBuilder.andWhere(
          `LOWER(user_peer_invites.status) = :status`, // assuming you have a `status` column
          { status: loweredStatus },
        );
      }

      queryBuilder.skip((page - 1) * limit).take(limit);

      const [result, total] = await queryBuilder.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      const pendingInvites = await this.countPendingPeerInvites(foundUser);
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
        pending_invites: pendingInvites,
        success: true,
      };
    } catch (error) {
      console.error('Error fetching user peers:', error);
      throw new HttpException(
        'An error occurred while fetching user peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async acceptInvite(user: any, id) {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      let message;
      const invite = await this.userPeerInvitesRepository.findOne({
        where: { id: id },
      });

      const response = await this.userService.getPeerInviteCodeStatus(
        invite?.invite_code,
        true,
      );

      console.log(invite, response, response.success, 'invitee');
      // return;

      if (response.success) {
        invite.status = 'accepted';
        await this.userPeerInvitesRepository.save(invite);

        const createSuccess = await this.userService.createUserPeer(
          invite?.invite_code,
          foundUser,
        );

        console.log(createSuccess, invite, response, 'invitee');

        if (createSuccess.success) {
          message = 'Invite has been Accepted';
          return {
            success: true,
            invite_status: invite.status,
            message: message,
          };
        }
      }

      return {
        success: false,
        message: response?.message,
      };
    } catch (err) {}
  }
  
  async rejectInvite(user: any, id) {
    try {
      console.log(user, id)
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      let message;
      const invite = await this.userPeerInvitesRepository.findOne({
        where: { id: id },
      });

      const response = await this.userService.getPeerInviteCodeStatus(
        invite?.invite_code,
        true,
      );

      console.log(invite, response, response.success, 'invitee');
      // return;

      if (response.success) {
        invite.status = 'declined';
        await this.userPeerInvitesRepository.save(invite);

        const createSuccess = await this.userService.rejectUserPeer(
          invite?.invite_code,
          foundUser,
        );

        console.log(createSuccess, invite, response, 'invitee');

        if (createSuccess.success) {
          message = 'Invite has been Rejected';
          return {
            success: true,
            invite_status: invite.status,
            message: message,
          };
        }
      }

      return {
        success: false,
        message: response?.message,
      };
    } catch (err) {}
  }

  async countPendingInvites(user: any): Promise<any> {
    const foundUser = await this.userService.getUserAccountById(user.userId);
    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const receivedPending = await this.countPendingPeerInvites(foundUser);
    const sentPending = await this.countSentPendingPeerInvites(foundUser);

    return {
      data: { receivedPending, sentPending },
      success: true,
    };
  }

  async countPendingPeerInvites(user) {
    return await this.userPeerInvitesRepository.count({
      where: {
        email: user.email,
        status: 'pending',
      },
    });
  }

  async countSentPendingPeerInvites(user) {
    return await this.userPeerInvitesRepository.count({
      where: {
        inviter_user_id: user,
        status: 'pending',
      },
    });
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
