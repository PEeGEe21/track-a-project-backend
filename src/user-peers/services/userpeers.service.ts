import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateUserpeerDto } from '../dto/create-userpeer.dto';
import { UpdateUserpeerDto } from '../dto/update-userpeer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { UsersService } from 'src/users/services/users.service';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserPeerStatusInviteType } from '../../utils/constants/userPeerEnums';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { Project } from 'src/typeorm/entities/Project';

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
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
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

  async findUserOrganizationPeers(
    user: any,
    organizationId: string,
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<any> {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const currentUserId = foundUser.id;

      // Main query for peers + shared count
      const queryBuilder = this.userOrganizationRepository
        .createQueryBuilder('uo')
        .leftJoinAndSelect('uo.user', 'user')
        // .leftJoinAndSelect('uo.organization', 'organization') // remove if not used
        .where('uo.organization_id = :organizationId', { organizationId })
        .andWhere('uo.user_id != :currentUserId', { currentUserId })
        .andWhere('uo.is_active = :active', { active: true })
        .andWhere('user.is_active = :active', { active: true })

        // Add shared projects count
        .addSelect((qb) => {
          return (
            qb
              .select('COUNT(DISTINCT pp.project_id)', 'shared_projects_count')
              .from(ProjectPeer, 'pp') // peer's membership
              .innerJoin(Project, 'p', 'p.id = pp.project_id')
              .where('pp.user_id = user.id') // peer is in the project
              .andWhere('p.organization_id = :organizationId', {
                organizationId,
              })
              .andWhere('pp.organization_id = :organizationId', {
                organizationId,
              })
              .andWhere(
                // Current user is either the OWNER or also a peer in the same project
                new Brackets((b) => {
                  b.where('p.user_id = :currentUserId', { currentUserId }) // you are owner
                    .orWhere(
                      'EXISTS ' +
                        qb
                          .subQuery()
                          .select('1')
                          .from(ProjectPeer, 'pp2')
                          .where('pp2.project_id = pp.project_id')
                          .andWhere('pp2.user_id = :currentUserId', {
                            currentUserId,
                          })
                          .getQuery(),
                    );
                }),
              )
              // Optional but recommended: only count active/confirmed connections
              .andWhere('pp.status = :status', {
                status: ProjectPeerStatus.CONNECTED,
              })
              .andWhere('pp.is_confirmed = :confirmed', { confirmed: true })
          );
        }, 'shared_projects_count');
      // Optional search
      if (search) {
        const searchTerm = `%${search.toLowerCase().trim()}%`;
        queryBuilder.andWhere(
          `(
          LOWER(user.first_name) LIKE :search OR
          LOWER(user.last_name) LIKE :search OR
          LOWER(user.email) LIKE :search OR
          LOWER(CONCAT(user.first_name, ' ', user.last_name)) LIKE :search
        )`,
          { search: searchTerm },
        );
      }

      // Ordering & pagination
      queryBuilder
        .orderBy('user.first_name', 'ASC')
        .addOrderBy('user.last_name', 'ASC')
        .skip((page - 1) * limit)
        .take(limit);

      // Get paginated data + raw values
      const { entities, raw } = await queryBuilder.getRawAndEntities();

      // Calculate TOTAL count (without pagination)
      const totalQuery = this.userOrganizationRepository
        .createQueryBuilder('uo')
        .leftJoin('uo.user', 'user')
        .where('uo.organization_id = :organizationId', { organizationId })
        .andWhere('uo.user_id != :currentUserId', { currentUserId })
        .andWhere('uo.is_active = :active', { active: true })
        .andWhere('user.is_active = :active', { active: true });

      if (search) {
        const searchTerm = `%${search.toLowerCase().trim()}%`;
        totalQuery.andWhere(
          `(
          LOWER(user.first_name) LIKE :search OR
          LOWER(user.last_name) LIKE :search OR
          LOWER(user.email) LIKE :search OR
          LOWER(CONCAT(user.first_name, ' ', user.last_name)) LIKE :search
        )`,
          { search: searchTerm },
        );
      }

      const total = await totalQuery.getCount();

      const lastPage = Math.ceil(total / limit);

      // Map results
      const peers = entities.map((uo, index) => {
        const row = raw[index];
        return {
          id: uo.user.id,
          first_name: uo.user.first_name,
          last_name: uo.user.last_name,
          full_name: uo.user.fullName,
          email: uo.user.email,
          role: uo.role,
          membership_active: uo.is_active,
          account_active: uo.user.is_active,
          joined_at: uo.created_at,
          avatar: uo.user.avatar,
          shared_projects_count: Number(row.shared_projects_count) || 0,
        };
      });

      return {
        data: peers,
        meta: {
          current_page: Number(page),
          from: (page - 1) * limit + 1,
          last_page: lastPage,
          per_page: Number(limit),
          to: (page - 1) * limit + peers.length,
          total, // ← now included!
        },
        success: true,
      };
    } catch (error) {
      console.error('Error fetching organization peers:', error);
      throw new HttpException(
        'An error occurred while fetching organization members',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findUserOrganizationPeers2(
    user: any,
    organizationId: string,
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<any> {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const queryBuilder = this.userOrganizationRepository
        .createQueryBuilder('uo') // alias: user_organization
        .leftJoinAndSelect('uo.user', 'user')
        .leftJoinAndSelect('uo.organization', 'organization')
        .where('uo.organization_id = :organizationId', { organizationId })
        .andWhere('uo.user_id != :currentUserId', {
          currentUserId: foundUser.id,
        })
        .andWhere('uo.is_active = :uoActive', { uoActive: true })
        .andWhere('user.is_active = :userActive', { userActive: true })
        .select([
          'uo.id',
          'uo.role',
          'uo.is_active',
          'uo.created_at',
          'user.id',
          'user.first_name',
          'user.is_active',
          'user.last_name',
          'user.email',
          'user.avatar',
        ]);

      // Optional search
      if (search) {
        const searchTerm = `%${search.toLowerCase().trim()}%`;
        queryBuilder.andWhere(
          `(
          LOWER(user.first_name) LIKE :search OR
          LOWER(user.last_name) LIKE :search OR
          LOWER(user.email) LIKE :search OR
          LOWER(CONCAT(user.first_name, ' ', user.last_name)) LIKE :search
        )`,
          { search: searchTerm },
        );
      }

      // Ordering: alphabetical by full name
      queryBuilder
        .orderBy('user.first_name', 'ASC')
        .addOrderBy('user.last_name', 'ASC');

      // Pagination
      queryBuilder.skip((page - 1) * limit).take(limit);

      // Execute
      const [userOrganizations, total] = await queryBuilder.getManyAndCount();

      const lastPage = Math.ceil(total / limit);

      // Map the result to return cleaner data (optional but recommended)
      const peers = userOrganizations.map((uo) => ({
        id: uo.user.id,
        first_name: uo.user.first_name,
        last_name: uo.user.last_name,
        full_name: uo.user.fullName,
        // full_name: `${uo.user.first_name || ''} ${
        //   uo.user.last_name || ''
        // }`.trim(),
        email: uo.user.email,
        role: uo.role,
        is_active: uo.is_active,
        joined_at: uo.created_at,
        avatar: uo.user.avatar, // if you want
      }));

      return {
        data: peers,
        meta: {
          current_page: Number(page),
          from: (page - 1) * limit + 1,
          last_page: lastPage,
          per_page: Number(limit),
          to: (page - 1) * limit + peers.length,
          total,
        },
        success: true,
      };
    } catch (error) {
      console.error('Error fetching organization peers:', error);
      throw new HttpException(
        'An error occurred while fetching organization members',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findTeamPeersList(user: any, organizationId: string) {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const orgMembers = await this.userOrganizationRepository.find({
        where: {
          organization_id: organizationId,
          is_active: true,
        },
        relations: ['user'],
      });

      console.log(orgMembers, 'orgMembers');

      // Exclude self
      const otherMembers = orgMembers.filter((m) => m.user_id !== foundUser.id);

      if (!otherMembers.length) {
        return {
          data: [],
          success: true,
          message: 'No other members in organization',
          total: otherMembers.length,
        };
      }

      // Using QueryBuilder to select specific fields
      const result = otherMembers.map((m) => ({
        id: m.user.id,
        peer_first_name: m.user.first_name,
        peer_last_name: m.user.last_name,
        peer_full_name: m.user.fullName,
        full_name: m.user.fullName,
        avatar: m.user.avatar,
        peer_avatar: m.user.avatar,
        email: m.user.email,
        peer_email: m.user.email,
        role: m.role,
      }));

      const total = otherMembers.length;

      return {
        data: result,
        success: true,
        total,
      };
    } catch (error) {
      console.error('Error fetching user peers:', error);
      throw new HttpException(
        'An error occurred while fetching user peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findUserPeersList(user: any) {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Using QueryBuilder to select specific fields
      const result = await this.userPeerRepository
        .createQueryBuilder('user_peer')
        .innerJoinAndSelect('user_peer.peer', 'peer')
        .where('user_peer.user.id = :userId', { userId: foundUser.id })
        .select([
          'user_peer.id',
          'peer.id',
          'peer.first_name',
          'peer.last_name',
          'peer.email',
          'peer.avatar',
          `CONCAT(peer.first_name, ' ', peer.last_name) AS "peer_full_name"`,
        ])
        .orderBy('user_peer.created_at', 'DESC')
        .getRawMany();

      const total = result.length;

      return {
        data: result,
        success: true,
        total,
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

  async acceptInvite(user: any, id: any, organizationId: string) {
    try {
      const foundUser = await this.userService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const invite = await this.userPeerInvitesRepository.findOne({
        where: { id },
        relations: ['inviter_user_id'],
      });

      if (!invite) {
        throw new HttpException('Invite not found', HttpStatus.NOT_FOUND);
      }

      // Check if user is trying to accept their own invite
      if (invite.email !== foundUser.email) {
        throw new HttpException(
          'This invite is not for you',
          HttpStatus.FORBIDDEN,
        );
      }

      // Validate invite status
      const response = await this.userService.getPeerInviteCodeStatus(
        invite.invite_code,
        true,
      );

      console.log(invite, response, 'invite validation');

      if (!response.success) {
        return {
          success: false,
          message: response.message,
        };
      }

      // Update invite status to accepted
      invite.status = 'accepted';
      await this.userPeerInvitesRepository.save(invite);

      // Create the peer connection
      const createSuccess = await this.userService.createUserPeer(
        invite.invite_code,
        foundUser,
        organizationId,
      );

      console.log(createSuccess, 'peer creation result');

      if (!createSuccess || !createSuccess.success) {
        // Rollback invite status if peer creation fails
        invite.status = 'pending';
        await this.userPeerInvitesRepository.save(invite);

        return {
          success: false,
          message: 'Failed to create peer connection',
        };
      }

      return {
        success: true,
        invite_status: invite.status,
        message: 'Invite has been accepted successfully',
      };
    } catch (err) {
      console.error('Error accepting invite:', err);

      if (err instanceof HttpException) {
        throw err;
      }

      throw new HttpException(
        'Failed to accept invite',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async acceptInvite2(user: any, id, organizationId: string) {
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
          organizationId,
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

  async rejectInvite(user: any, id, organizationId: string) {
    try {
      console.log(user, id);
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
          organizationId,
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
