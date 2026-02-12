import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserParams,
  CreateUserPostParams,
  CreateUserProfileParams,
  UpdateUserParams,
  UserStatus,
} from '../../utils/types';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { UpdateUserPasswordDto } from '../dtos/UpdateUserPassword.dto';
import { JwtService } from '@nestjs/jwt';
import { Project } from 'src/typeorm/entities/Project';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { randomBytes } from 'crypto';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { addDays, addHours } from 'date-fns';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { UserPeerStatus } from '../../utils/constants/userPeerEnums';
import {
  ProjectStatus,
  statusColors,
  statusLabels,
} from 'src/utils/constants/project';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import * as moment from 'moment';
import { ActivityType } from 'src/utils/constants/activity';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { AuthUser } from 'src/types/users';
import { PaginatedResponse } from 'src/types/pagination';
import { FindUsersQueryDto } from '../dtos/FindUsersQuery.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(ProjectActivity)
    private projectActivityRepository: Repository<ProjectActivity>,
    @InjectRepository(UserPeer)
    private userPeerRepository: Repository<UserPeer>,
    @InjectRepository(ProjectPeer)
    private projectPeerRepository: Repository<ProjectPeer>,
    @InjectRepository(UserPeerInvite)
    private userPeerInviteRepository: Repository<UserPeerInvite>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    private jwtService: JwtService,
    private MailingService: MailingService,
    private notificationService: NotificationsService,
  ) {}

  async getUserAccountById(id: number): Promise<User | undefined> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    }
    return user;
  }

  async getUserAccountByEmail(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    // console.log(user, email, 'userr');

    // if (!user) {
    //   throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    // }
    return user;
  }

  async getUserRole(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    return user.role;
  }

  async getUserOrganizationsById(userId: number) {
    const organizations = this.userOrganizationRepository.find({
      where: { user_id: userId },
      relations: ['organization'],
    });

    return organizations;
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

  async updateUserPassword(
    id: number,
    updateUserPasswordDto: UpdateUserPasswordDto,
  ): Promise<any> {
    try {
      if (
        updateUserPasswordDto.confirm_password !==
        updateUserPasswordDto.new_password
      ) {
        return {
          error: 'error',
          message: 'Confirm Password and New Password do not match',
        };
      }

      const user = await this.getUserAccountById(id);

      const userPassword = await this.getUserAccountPassword(user.email);

      console.log(user, userPassword);

      const isCorrectPassword = await bcrypt.compare(
        updateUserPasswordDto.current_password,
        userPassword,
      );

      if (!isCorrectPassword) {
        return {
          error: 'error',
          message: 'Your Password is Incorrect',
        };
      }

      console.log(isCorrectPassword, updateUserPasswordDto.new_password);

      if (updateUserPasswordDto.new_password) {
        const saltOrRounds = 10;
        updateUserPasswordDto.new_password = await bcrypt.hash(
          updateUserPasswordDto.new_password,
          saltOrRounds,
        );
      }

      const data = {
        password: updateUserPasswordDto.new_password,
      };

      const updatedUserResult = await this.userRepository.update(
        { id: user.id },
        { ...data },
      );

      if (updatedUserResult.affected < 1) {
        return {
          error: 'error',
          message: 'User Update Failed',
        };
      }

      const settings = await this.getUserSettings(user.id);

      return {
        profile: settings.profile,
        user: settings.user,
        success: 'success',
        message: 'Successfully updated user!',
      };
    } catch (err) {}
  }

  async getUserSettings(id: number): Promise<any | undefined> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          id: id,
        },
        relations: ['profile'],
      });

      if (!user) {
        throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
      }

      const userProfileDetails = await this.profileRepository.findOne({
        where: { user: user },
        relations: ['user'],
      });

      delete userProfileDetails.user.password;
      delete user.password;

      return {
        profile: userProfileDetails,
        user: user,
        success: 'success',
      };
    } catch (err) {}
  }

  async updateUserProfile(
    id: number,
    createUserProfileDetails: CreateUserProfileParams,
  ) {
    try {
      const user = await this.userRepository.findOneBy({ id });
      if (!user)
        throw new HttpException(
          'User not found. Cannot create Profile',
          HttpStatus.BAD_REQUEST,
        );

      const userProfile = await this.profileRepository.findOne({
        where: { user: user },
      });

      const userData = {
        profile: userProfile,
        email: createUserProfileDetails.email,
      };

      const updatedUserDetailResult = await this.userRepository.update(
        { id: id },
        { ...userData },
      );

      if (updatedUserDetailResult.affected < 1) {
        return {
          error: 'error',
          message: 'User Profile Update Failed',
        };
      }

      const updatedResult = await this.profileRepository.update(
        { id: userProfile.id },
        { ...createUserProfileDetails },
      );

      console.log(updatedResult, 'rererr');

      if (updatedResult.affected < 1) {
        return {
          error: 'error',
          message: 'User Profile Update Failed',
        };
      }
      const settings = await this.getUserSettings(id);

      return {
        profile: settings.profile,
        user: settings.user,
        success: 'success',
        message: 'Successfully updated profile!',
      };
    } catch (err) {}
  }

  async getUserAccountPassword(email: string): Promise<string | undefined> {
    const user = await this.userRepository.findOneBy({ email });
    return user?.password;
  }

  async findAllUsers(
    authUser: AuthUser,
    query: FindUsersQueryDto,
  ): Promise<PaginatedResponse<User>> {
    const { page = 1, limit = 10, search, orderBy, status } = query;

    const foundUser = await this.getUserAccountById(authUser.userId);
    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_organizations', 'userOrganizations')
      .leftJoinAndSelect('userOrganizations.organization', 'organization');

    if (search) {
      qb.andWhere(
        `(LOWER(user.first_name) LIKE :search
        OR LOWER(user.last_name) LIKE :search
        OR LOWER(user.email) LIKE :search
        OR LOWER(user.username) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (status) {
      qb.andWhere('user.is_active = :active', {
        active: status === UserStatus.ACTIVE,
      });
    }

    qb.orderBy('user.created_at', orderBy);
    qb.skip((page - 1) * limit).take(limit);

    const [result, total] = await qb.getManyAndCount();

    return {
      data: result,
      meta: {
        current_page: page,
        from: (page - 1) * limit + 1,
        last_page: Math.ceil(total / limit),
        per_page: limit,
        to: (page - 1) * limit + result.length,
        total,
      },
      success: true,
    };
  }

  async findUsers() {
    const users = await this.userRepository.find({
      relations: ['profile', 'projects'],
    });
    const res = {
      success: 'ok',
      message: 'sucessfull',
      data: users,
    };

    return res;
  }

  createUser(userDetails: CreateUserParams) {
    const newUser = this.userRepository.create({
      ...userDetails,
      created_at: new Date(),
    });
    return this.userRepository.save(newUser);
  }

  updateUser(id: number, updateUserDetails: UpdateUserParams) {
    return this.userRepository.update({ id }, { ...updateUserDetails });
  }

  deleteUser(id: number) {
    return this.userRepository.delete({ id });
  }

  // async createUserProfile(
  //   id: string,
  //   createUserProfileDetails: CreateUserProfileParams,
  // ) {
  //   const user = await this.userRepository.findOneBy({ id });
  //   if (!user)
  //     throw new HttpException(
  //       'User not found. Cannot create Profile',
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   const newProfile = this.profileRepository.create(createUserProfileDetails);
  //   const savedProfile = await this.profileRepository.save(newProfile);
  //   user.profile = savedProfile;
  //   return this.userRepository.save(user);
  // }

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

  async getUserPeersById(id: number): Promise<any> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user)
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

    const project_peers = await this.projectPeerRepository.find({
      where: {
        addedBy: user,
      },
      relations: ['addedBy', 'projects'],
    });
    console.log(project_peers, 'project_peer');

    let data = {
      success: 'success',
      data: project_peers,
    };
    return data;
  }

  // send peer invite
  async sendPeerInvite(
    user: any,
    inviteData,
    organizationId: string,
  ): Promise<any> {
    try {
      const { emails, selectedRole: invite_as } = inviteData;
      const foundUser = await this.getUserAccountById(user.userId);

      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const peerEmailsArray = await this.validatePeerInviteEmails(emails);

      // Basic email regex (reasonable coverage)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Validate all emails first
      const invalidEmails = peerEmailsArray.filter(
        (email: string) => !emailRegex.test(email),
      );

      if (invalidEmails.length > 0) {
        throw new HttpException(
          `Invalid email address(es) provided: ${invalidEmails.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = [];

      for (const email of peerEmailsArray) {
        try {
          // Skip if trying to invite yourself
          if (foundUser?.email === email) {
            console.log(`Skipping self-invite for ${email}`);
            continue;
          }

          // Check if user account exists
          const foundPeer = await this.checkUserAccountEmailExists(email);
          const foundPeerUser = foundPeer
            ? await this.getUserAccountByEmail(email)
            : null;

          // Check BOTH directions for existing peer relationship
          let existingPeer = null;
          if (foundPeerUser) {
            existingPeer = await this.userPeerRepository.findOne({
              where: [
                // Check if foundUser has foundPeerUser as peer
                {
                  user: { id: foundUser?.id },
                  peer: { id: foundPeerUser?.id },
                },
                // Check if foundPeerUser has foundUser as peer (reverse)
                {
                  user: { id: foundPeerUser?.id },
                  peer: { id: foundUser?.id },
                },
              ],
            });
          }

          // Skip if peer relationship already exists
          if (existingPeer) {
            console.log(`Peer relationship already exists with ${email}`);
            continue;
          }

          // Check for existing pending invite
          const existingInvite = await this.userPeerInviteRepository.findOne({
            where: {
              inviter_user_id: { id: foundUser?.id },
              email,
              status: 'pending',
            },
          });

          if (existingInvite) {
            console.log(`Pending invite already exists for ${email}`);
            continue;
          }

          const inviteCode = this.generateInviteCode();

          // Save the invite
          await this.userPeerInviteRepository.save({
            inviter_user_id: foundUser,
            email,
            invite_code: inviteCode,
            invited_as: invite_as.toLowerCase(),
            status: 'pending',
            due_date: addDays(new Date(), 7), // optional 7-day expiry
          });

          // Only send notification if the user already has an account
          if (foundPeer && foundPeerUser) {
            const payload = {
              recipient: foundPeerUser,
              sender: user,
              title: 'You received an invite',
              message: `${user?.email} sent you an invite to be their Peer`,
              type: 'peer_request',
            };

            await this.notificationService.createNotification(
              foundPeer,
              payload,
              organizationId,
            );
          }

          // Send email invite
          await this.sendInviteMail(
            email,
            foundPeer,
            foundUser,
            invite_as,
            inviteCode,
            foundPeerUser,
          );

          results.push({ email, status: 'sent' });
        } catch (err) {
          console.error(`Error sending invite to ${email}:`, err);
          results.push({ email, status: 'failed', error: err.message });
          // Continue with next email instead of failing everything
        }
      }

      console.log('Peer invite results:', results);

      return {
        success: true,
        message: 'Peer Invite Sent Successfully',
        details: results,
      };
    } catch (err) {
      console.error('Error in sending peer invite:', err);
      throw new UnauthorizedException('Could Not Send Peer Invite');
    }
  }

  async sendPeerInvite2(
    user: any,
    inviteData,
    organizationId: string,
  ): Promise<any> {
    try {
      const { emails, selectedRole: invite_as } = inviteData;
      const foundUser = await this.getUserAccountById(user.userId);

      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const peerEmailsArray = await this.validatePeerInviteEmails(emails);

      // Basic email regex (reasonable coverage)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Validate all emails first
      const invalidEmails = peerEmailsArray.filter(
        (email: string) => !emailRegex.test(email),
      );

      if (invalidEmails.length > 0) {
        throw new HttpException(
          `Invalid email address(es) provided: ${invalidEmails.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // console.log(peerEmailsArray, invite_as)
      // return
      try {
        for (const email of peerEmailsArray) {
          let foundPeer = null;

          foundPeer = await this.checkUserAccountEmailExists(email);
          const foundPeerUser = await this.getUserAccountByEmail(email);

          const existingPeer = foundPeer
            ? await this.userPeerRepository.findOne({
                where: {
                  user: { id: foundUser?.id },
                  peer: { id: foundPeerUser?.id },
                },
              })
            : null;

          // console.log(foundPeer, existingPeer, existingPeer || foundUser?.email == email);
          // console.log(foundPeer, foundPeerUser, "sending peer invite");
          // return
          // return;
          // skip if existting peer and current user email is incuded
          if (existingPeer || foundUser?.email == email) continue;

          const inviteCode = this.generateInviteCode();

          // console.log(inviteCode, 'invite code')
          // return
          await this.userPeerInviteRepository.save({
            inviter_user_id: foundUser,
            email,
            invite_code: inviteCode,
            invited_as: invite_as.toLowerCase(),
            status: 'pending',
            due_date: addDays(new Date(), 7), // optional 7-day expiry
          });

          const payload = {
            recipient: foundPeerUser,
            sender: user,
            title: 'You received an invite',
            message: `${user?.email} sent you an invite to be his Peer`,
            type: 'peer_request',
          };
          // build payload
          await this.notificationService.createNotification(
            foundPeer,
            payload,
            organizationId,
          );

          await this.sendInviteMail(
            email,
            foundPeer,
            foundUser,
            invite_as,
            inviteCode,
            foundPeerUser,
          );
        }
      } catch (err) {}
      console.log(peerEmailsArray, 'peerEmailsArray');

      return {
        success: true,
        message: 'Peer Invite Sent Successfully',
      };
    } catch (err) {
      console.error('Error in sending peer invite:', err);
      throw new UnauthorizedException('Could Not Send Peer Invite');
    }
  }

  async validatePeerInviteEmails(emails: string): Promise<string[]> {
    const peerEmails = emails.split(',').map((email) => email.trim());
    const peerEmailsSet = new Set(peerEmails);
    const peerEmailsArray = Array.from(peerEmailsSet);
    return peerEmailsArray;
  }

  generateInviteCode(): string {
    return randomBytes(20).toString('hex').slice(0, 15);
  }

  async sendInviteMail(
    email: string,
    foundPeer,
    user,
    invite_as = '',
    inviteCode,
    existingPeer,
    project = null,
  ): Promise<any> {
    let peerEmail;
    let eventLink;
    let peerAccount = false;
    // const inviteCode = this.generateInviteCode(); // Assuming you have this function

    // console.log(existingPeer, 'fkknd')
    // user already exists just not a peer
    if (foundPeer || existingPeer) {
      //   peerEmail = `You just received an invite to become a peer(${invite_as}) by ${user.email}.
      //   Accept invite and onboard to the project tracking platform to view the project.
      //  `;
      eventLink = ` ${process.env.FRONTEND_URL}/auth/login?${inviteCode}`;
    } else {
      // peerEmail = `You just received an invite to become a peer(${invite_as}) by ${user.email}.
      // Accept invite and onboard to the project tracking platform to view the project.
      // `;
      eventLink = `${process.env.FRONTEND_URL}/auth/peer-invite?refCode=${inviteCode}&refEmail=${email}`;
      // eventLink = `${process.env.PEER_LINK_MAIN}/peerinvites/${inviteCode}/${user.id}`;
    }

    console.log(email, user, eventLink, peerAccount, peerEmail);

    // return;
    await this.MailingService.sendPeerInvite(
      email,
      user,
      eventLink,
      foundPeer,
      peerEmail,
    );
  }

  async getPeerInviteCodeStatus(
    inviteCode: string,
    markExpire = true,
  ): Promise<{
    success: boolean;
    status: string;
    isActive: boolean;
    message: string;
  }> {
    try {
      const invite = await this.userPeerInviteRepository.findOne({
        where: { invite_code: inviteCode },
      });

      console.log(invite, 'invite lookup');

      if (!invite) {
        return {
          success: false,
          status: 'invalid',
          isActive: false,
          message: 'Invite not found.',
        };
      }

      // Check if already accepted or rejected
      if (invite.status === 'accepted') {
        return {
          success: false,
          status: 'accepted',
          isActive: false,
          message: 'Invite has already been accepted.',
        };
      }

      if (invite.status === 'declined') {
        return {
          success: false,
          status: 'rejected',
          isActive: false,
          message: 'Invite was rejected.',
        };
      }

      // Check expiration
      if (markExpire && invite.due_date) {
        // Use UTC time consistently
        const now = new Date();
        const isExpired = invite.due_date <= now;

        if (isExpired && invite.status === 'pending') {
          invite.status = 'expired';
          await this.userPeerInviteRepository.save(invite);

          return {
            success: false,
            status: 'expired',
            isActive: false,
            message: 'Invite has expired.',
          };
        }
      }

      if (invite.status === 'expired') {
        return {
          success: false,
          status: 'expired',
          isActive: false,
          message: 'Invite has expired.',
        };
      }

      // If still pending and valid
      if (invite.status === 'pending') {
        return {
          success: true,
          status: 'pending',
          isActive: true,
          message: 'Invite is valid and pending.',
        };
      }

      // Any other status
      return {
        success: false,
        status: invite.status,
        isActive: false,
        message: 'Invite is no longer valid.',
      };
    } catch (err) {
      console.error('Error checking invite status:', err);
      return {
        success: false,
        status: 'error',
        isActive: false,
        message: 'Error checking invite status.',
      };
    }
  }

  async getPeerInviteCodeStatus2(
    inviteCode: string,
    markExpire = true,
  ): Promise<{
    success: boolean;
    status: string;
    isActive: boolean;
    message: string;
  }> {
    const invite = await this.userPeerInviteRepository.findOne({
      where: { invite_code: inviteCode },
    });

    console.log(invite, 'invite');
    // return
    if (!invite) {
      return {
        success: false,
        status: 'invalid',
        isActive: false,
        message: 'Invite not found.',
      };
    }

    console.log(invite, 'invite');

    if (markExpire) {
      // Adjust now by +1 hour to account for timezone difference
      const now = addHours(new Date(), 1);
      const isExpired = invite.due_date ? invite.due_date <= now : true;

      // Auto-mark as expired if due date passed and status is still pending
      if (isExpired && invite.status === 'pending') {
        invite.status = 'expired';
        await this.userPeerInviteRepository.save(invite);
      }
    }

    if (invite.status === 'expired') {
      return {
        success: false,
        status: 'expired',
        isActive: false,
        message: 'Invite has expired.',
      };
    }

    if (invite.status !== 'pending') {
      return {
        success: false,
        status: invite.status,
        isActive: false,
        message: 'Invite is no longer valid.',
      };
    }

    // If still pending and valid
    return {
      success: true,
      status: 'pending',
      isActive: true,
      message: 'Invite is valid and pending.',
    };
  }

  async submitPeerInviteCodeStatus(inviteData) {
    const { inviteCode, type, user_type } = inviteData;
    let message = '';
    const invite = await this.userPeerInviteRepository.findOne({
      where: { invite_code: inviteCode },
    });

    const response = await this.getPeerInviteCodeStatus(inviteCode, false);
    if (response.success) {
      if (type == 'accept') {
        invite.status = 'accepted';
        await this.userPeerInviteRepository.save(invite);
        message = 'Invite has been Accepted';
      } else {
        invite.status = 'declined';
        await this.userPeerInviteRepository.save(invite);
        message = 'Invite has been Rejected';
      }
      return {
        success: true,
        invite_status: invite.status,
        email: invite.email,
        message: message,
      };
    }

    return {
      success: false,
      message: response?.message,
    };
  }

  async createUserPeer(
    inviteCode: string,
    newUser: User,
    organizationId: string,
  ) {
    try {
      const invite = await this.userPeerInviteRepository.findOne({
        where: { invite_code: inviteCode },
        relations: ['inviter_user_id'],
      });

      console.log(invite, 'invite in create user peer');

      if (!invite) {
        console.log('Invalid invite code');
        return {
          success: false,
          message: 'Invalid invite code',
        };
      }

      if (!invite.inviter_user_id) {
        console.log('Inviter not found');
        return {
          success: false,
          message: 'Inviter not found',
        };
      }

      const invitedBy = await this.getUserAccountById(
        invite.inviter_user_id.id,
      );

      if (!invitedBy) {
        console.log('Inviter account not found');
        return {
          success: false,
          message: 'Inviter account not found',
        };
      }

      console.log(invite.status, 'invite status');

      if (invite.status !== 'accepted') {
        console.log('Invite not in accepted status');
        return {
          success: false,
          message: 'Invite must be accepted first',
        };
      }

      // Check if peer connection already exists in either direction
      const existingConnection = await this.userPeerRepository
        .createQueryBuilder('user_peer')
        .where(
          '(user_peer.user_id = :user1 AND user_peer.peer_id = :user2) OR (user_peer.user_id = :user2 AND user_peer.peer_id = :user1)',
          { user1: invitedBy.id, user2: newUser.id },
        )
        .getOne();

      console.log(existingConnection, 'existing connection check');

      if (existingConnection) {
        console.log(
          `Users ${invitedBy.id} and ${newUser.id} are already connected`,
        );
        return {
          success: false,
          message: 'Users are already connected as peers',
        };
      }

      // Create bidirectional peer relationship
      const peerToUser = this.userPeerRepository.create({
        status: UserPeerStatus.CONNECTED,
        connection_type: invite.invited_as,
        is_confirmed: true,
        user: { id: invitedBy.id },
        peer: { id: newUser.id },
      });

      const userToPeer = this.userPeerRepository.create({
        status: UserPeerStatus.CONNECTED,
        connection_type: invite.invited_as,
        is_confirmed: true,
        user: { id: newUser.id },
        peer: { id: invitedBy.id },
      });

      await this.userPeerRepository.save([peerToUser, userToPeer]);

      // Send notification to the inviter
      const payloadToInviter = {
        recipient: invitedBy,
        sender: newUser,
        title: 'Peer Invite Accepted',
        message: `${newUser.email} has accepted your invitation to be a Peer`,
        type: 'peer_request',
      };

      await this.notificationService.createNotification(
        invitedBy,
        payloadToInviter,
        organizationId,
      );

      // Send notification to the new user
      const payloadToNewUser = {
        recipient: newUser,
        sender: invitedBy,
        title: 'Peer Connection Established',
        message: `You are now connected with ${invitedBy.email} as a Peer`,
        type: 'peer_request',
      };

      await this.notificationService.createNotification(
        newUser,
        payloadToNewUser,
        organizationId,
      );

      console.log('Peer connection created successfully');

      return {
        success: true,
        message: 'Peer connection created successfully',
      };
    } catch (err) {
      console.error('Error creating user peer:', err);
      return {
        success: false,
        message: 'Failed to create peer connection',
        error: err.message,
      };
    }
  }

  async createUserPeer2(
    inviteCode: string,
    newUser: User,
    organizationId: string,
  ) {
    try {
      const invite = await this.userPeerInviteRepository.findOne({
        where: { invite_code: inviteCode },
        relations: ['inviter_user_id'],
      });

      console.log(invite, 'invite in create user peer');
      if (!invite) {
        // Invalid invite code — silently skip peer creation (optional: log if needed)
        return null;
      }

      const invitedBy = await this.getUserAccountById(
        invite.inviter_user_id.id,
      );

      console.log(invite.status, 'invite.status');
      if (invite.status !== 'accepted') {
        // Invite not accepted — skip peer creation
        return null;
      }

      // Check if peer connection already exists in either direction
      // const existingConnection = await this.userPeerRepository.findOne({
      //   where: [
      //     { user: { id: invitedBy.id }, peer: { id: newUser.id } },
      //     { user: { id: newUser.id }, peer: { id: invitedBy.id } },
      //   ],
      // });
      const existingConnection = await this.userPeerRepository
        .createQueryBuilder('user_peer')
        .where(
          '(user_peer.user_id = :user1 AND user_peer.peer_id = :user2) OR (user_peer.user_id = :user2 AND user_peer.peer_id = :user1)',
          { user1: invitedBy.id, user2: newUser.id },
        )
        .getOne();

      console.log(existingConnection, 'existingConnection');

      if (existingConnection) {
        console.log(
          `Users ${invitedBy.id} and ${newUser.id} are already connected. Skipping peer creation.`,
        );
        return null;
      }

      console.log(existingConnection, 'existingConnection');
      // if (existingConnection) {
      //   // Already connected — skip peer creation silently
      //   return null;
      // }

      const peerToUser = this.userPeerRepository.create({
        status: UserPeerStatus.CONNECTED,
        connection_type: invite.invited_as,
        is_confirmed: true,
        user: { id: invitedBy.id },
        peer: { id: newUser.id },
      });

      const userToPeer = this.userPeerRepository.create({
        status: UserPeerStatus.CONNECTED,
        connection_type: invite.invited_as,
        is_confirmed: true,
        user: { id: newUser.id },
        peer: { id: invitedBy.id },
      });

      await this.userPeerRepository.save([peerToUser, userToPeer]);

      const payload = {
        recipient: invitedBy,
        sender: newUser,
        title: 'Peer Invite Acceptance',
        message: `${newUser?.email} has accepted your invitation to be a Peer`,
        type: 'peer_request',
      };

      console.log(payload);

      // build payload
      await this.notificationService.createNotification(
        newUser,
        payload,
        organizationId,
      );

      const payload2 = {
        recipient: newUser,
        sender: invitedBy,
        title: 'Peer Invite Acceptance',
        message: `You accepted an invite to be ${invitedBy}'s Peer`,
        type: 'peer_request',
      };

      await this.notificationService.createNotification(
        newUser,
        payload2,
        organizationId,
      );

      return {
        success: true,
      };
      // return { peerToUser, userToPeer };
    } catch (err) {
      return {
        success: false,
      };
    }
  }

  // async rejectUserPeer(inviteCode: string, newUser: User) {
  //   try {
  //     const invite = await this.userPeerInviteRepository.findOne({
  //       where: { invite_code: inviteCode },
  //       relations: ['inviter_user_id'],
  //     });

  //     console.log(invite, 'invite in create user peer');
  //     if (!invite) {
  //       // Invalid invite code — silently skip peer creation (optional: log if needed)
  //       return null;
  //     }

  //     const invitedBy = await this.getUserAccountById(
  //       invite.inviter_user_id.id,
  //     );

  //     console.log(invite.status, 'invite.status');
  //     if (invite.status !== 'declined') {
  //       // Invite not accepted — skip peer creation
  //       return null;
  //     }

  //     const payload = {
  //       recipient: invitedBy,
  //       sender: newUser,
  //       title: 'Peer Invite Rejection',
  //       message: `${newUser?.email} has rejected your invitation to be a Peer`,
  //       type: 'peer_request',
  //     };

  //     console.log(payload);

  //     // build payload
  //     await this.notificationService.createNotification(newUser, payload);

  //     const payload2 = {
  //       recipient: newUser,
  //       sender: invitedBy,
  //       title: 'Peer Invite Rejection',
  //       message: `You rejected an invite to be ${invitedBy}'s Peer`,
  //       type: 'peer_request',
  //     };

  //     await this.notificationService.createNotification(newUser, payload2);

  //     return {
  //       success: true,
  //     };
  //     // return { peerToUser, userToPeer };
  //   } catch (err) {
  //     return {
  //       success: false,
  //     };
  //   }
  // }

  async rejectUserPeer(inviteCode: string, newUser: User, organizationId: string) {
    try {
      const invite = await this.userPeerInviteRepository.findOne({
        where: { invite_code: inviteCode },
        relations: ['inviter_user_id'], // Use the actual relation property name
      });

      if (!invite) {
        return null;
      }

      const invitedBy = await this.getUserAccountById(
        invite.inviter_user_id.id,
      );

      if (invite.status !== 'declined') {
        return null;
      }

      const existingConnection = await this.userPeerRepository
        .createQueryBuilder('user_peer')
        .where(
          '(user_peer.user_id = :user1 AND user_peer.peer_id = :user2) OR (user_peer.user_id = :user2 AND user_peer.peer_id = :user1)',
          { user1: invitedBy.id, user2: newUser.id },
        )
        .getOne();

      if (!existingConnection) {
        console.log(
          `Users ${invitedBy.id} and ${newUser.id} are already connected. Skipping peer creation.`,
        );

        await this.notifyInviter(invitedBy, newUser, organizationId);

        await this.notifyReceiver(invitedBy, newUser, organizationId);

        return { success: true };
      }
      return { success: true };
    } catch (err) {
      console.error('Error rejecting peer invite:', err);
      return { success: false, message: 'Failed to reject peer invite.' };
    }
  }

  async notifyInviter(invitedBy, newUser, organizationId) {
    const payloadForInviter = {
      recipient: invitedBy,
      sender: newUser,
      title: 'Peer Invite Rejection',
      message: `${newUser?.email} has rejected your invitation to be a Peer`,
      type: 'peer_request',
    };

    await this.notificationService.createNotification(
      invitedBy,
      payloadForInviter,
      organizationId
    );
  }

  async notifyReceiver(invitedBy, newUser, organizationId) {
    const payloadForRejecter = {
      recipient: newUser,
      sender: invitedBy,
      title: 'Peer Invite Rejection',
      message: `You rejected an invite to be ${invitedBy?.email}'s Peer`,
      type: 'peer_request',
    };

    await this.notificationService.createNotification(
      newUser,
      payloadForRejecter,
      organizationId
    );
  }

  // get user profile
  async getUserProfile(user: any): Promise<any> {
    try {
      const foundUser = await this.getUserAccountById(user.userId);

      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // delete foundUser.password;

      const userOrganizations = await this.getUserOrganizationsById(
        foundUser.id,
      );

      return {
        success: true,
        data: {
          ...foundUser,
          organizations: userOrganizations,
        },
      };
    } catch (err) {
      console.error('Error in getUserProfile:', err);
      throw new UnauthorizedException('Could not fetch user profile');
    }
  }

  // statusOptions = ['upcoming', 'active', 'paused', 'completed', 'overdue'];
  // user dashboard data
  // async getUserDshboardData(user: any): Promise<any> {
  //   try {
  //     const foundUser = await this.getUserAccountById(user.userId);

  //     if (!foundUser) {
  //       throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
  //     }

  //     const projects = await this.projectRepository.find({
  //       where: { user: { id: foundUser.id } },
  //       relations: [
  //         'user',
  //         'categories',
  //         'tags',
  //         'projectPeers',
  //         'projectPeers.user',
  //       ],
  //       take: 8,
  //       order: {
  //         created_at: 'DESC',
  //       },
  //     });

  //     // Remove sensitive user data
  //     const cleanedProjects = projects.map((project) => {
  //       // Clean project.user
  //       let safeUser = null;
  //       if (project.user) {
  //         const { password, logged_in, created_at, updated_at, ...restUser } =
  //           project.user;
  //         safeUser = restUser;
  //       }

  //       // Clean projectPeers[].user
  //       const safeProjectPeers =
  //         project.projectPeers?.map((peer) => {
  //           if (peer.user) {
  //             const {
  //               password,
  //               logged_in,
  //               created_at,
  //               updated_at,
  //               ...restPeerUser
  //             } = peer.user;
  //             return {
  //               ...peer,
  //               user: restPeerUser,
  //             };
  //           }
  //           return peer;
  //         }) || [];

  //       // VERY IMPORTANT: this return!
  //       return {
  //         ...project,
  //         user: safeUser,
  //         projectPeers: safeProjectPeers,
  //       };
  //     });

  //     const userPeers = await this.userPeerRepository.find({
  //       where: { user: { id: foundUser.id } },
  //       relations: ['user', 'peer'],
  //       take: 8,
  //     });

  //     // Also sanitize the userPeers data
  //     const sanitizedUserPeers = JSON.parse(JSON.stringify(userPeers)).map(
  //       (userPeer) => {
  //         if (userPeer.user) {
  //           const {
  //             password,
  //             logged_in,
  //             created_at,
  //             updated_at,
  //             deleted_at,
  //             ...safeUserData
  //           } = userPeer.user;
  //           userPeer.user = safeUserData;
  //         }

  //         if (userPeer.peer) {
  //           const {
  //             password,
  //             logged_in,
  //             created_at,
  //             updated_at,
  //             deleted_at,
  //             ...safePeerData
  //           } = userPeer.peer;
  //           userPeer.peer = safePeerData;
  //         }

  //         return userPeer;
  //       },
  //     );

  //     // Initialize status counts
  //     const statusCounts: Record<string, number> = {};
  //     Object.values(ProjectStatus).forEach((status) => {
  //       statusCounts[status] = 0;
  //     });

  //     // Count projects per status
  //     projects.forEach((project) => {
  //       const projectStatus = project.status?.toLowerCase();
  //       if (Object.values(ProjectStatus).includes(projectStatus)) {
  //         statusCounts[projectStatus]++;
  //       }
  //     });

  //     // To return it in array form like [56, 79, 89, 7, 10] in statusOptions order
  //     const statusArray = Object.values(ProjectStatus).map(
  //       (status) => statusCounts[status],
  //     );

  //     return {
  //       statusCounts,
  //       statusArray,
  //       projects: cleanedProjects,
  //       userPeers: sanitizedUserPeers,
  //       success: 'success',
  //       message: 'Successfully fetched user dashboard data!',
  //     };
  //   } catch (err) {
  //     console.error('Error in getUserDshboardData:', err);
  //     throw new UnauthorizedException('Could not fetch user dashboard data');
  //   }
  // }

  /**
   * --------------------------------------------------------------
   *  Optimized User Dashboard Data
   * --------------------------------------------------------------
   * Fetches comprehensive dashboard analytics for the authenticated user
   */
  async getUserDashboardData(user: any, organizationId: string): Promise<any> {
    try {
      const foundUser = await this.userRepository.findOne({
        where: { id: user.userId },
      });

      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Date ranges for analytics
      const now = new Date();
      const sevenDaysAgo = addDays(now, -7);
      const thirtyDaysAgo = addDays(now, -30);

      // Execute all queries in parallel for better performance
      const [
        ownedProjects,
        peerProjects,
        projectStatusStats,
        tasksByProject,
        recentActivities,
        userPeers,
        activeProjectsCount,
        completionStats,
        taskCompletionTrend,
        activityHeatmap,
        topCollaborators,
      ] = await Promise.all([
        // 1. Get user's owned projects (recent 8)
        this.getOwnedProjects(foundUser.id),

        // 2. Get projects where user is a peer
        this.getPeerProjects(foundUser.id),

        // 3. Project status distribution
        this.getProjectStatusDistribution(foundUser.id),

        // 4. Tasks by project (for stacked bar chart)
        this.getTasksByProject(foundUser.id),

        // 5. Recent activities across all projects
        this.getRecentActivities(foundUser.id),

        // 6. User peers
        this.getUserPeers(foundUser.id),

        // 7. Active projects count
        this.getActiveProjectsCount(foundUser.id),

        // 8. Completion statistics
        this.getCompletionStats(foundUser.id),

        // 9. Task completion trend (last 7 days)
        this.getTaskCompletionTrend(foundUser.id),

        // 10. Activity heatmap (last 30 days)
        this.getActivityHeatmap(foundUser.id),

        // 11. Top collaborators
        this.getTopCollaborators(foundUser.id),
      ]);

      // Combine owned and peer projects for full project list
      const allProjects = [...ownedProjects, ...peerProjects];

      // Calculate key metrics
      const totalProjects = allProjects.length;
      const overdueTasks = await this.getOverdueTasks(foundUser.id);
      const upcomingDeadlines = await this.getUpcomingDeadlines(foundUser.id);
      const activePeers = await this.getActivePeers(foundUser.id);

      return {
        success: true,
        message: 'Successfully fetched user dashboard data!',
        data: {
          // Key Metrics
          metrics: {
            activeProjects: activeProjectsCount,
            totalProjects,
            upcomingDeadlines,
            completionRate: completionStats.completionRate,
            overdueTasks,
            activePeers,
            trendsVsLastPeriod: {
              projects: await this.calculateProjectTrend(foundUser.id),
              tasks: await this.calculateTaskTrend(foundUser.id),
            },
          },

          // Project Status Distribution (for Pie Chart)
          projectStatusDistribution: projectStatusStats,

          // Tasks by Project (for Stacked Bar Chart)
          tasksByProject,

          // Recent Projects
          recentProjects: ownedProjects.slice(0, 5),

          // Recent Activities (for Activity Feed)
          recentActivities,

          // User Peers
          userPeers: userPeers.slice(0, 5),

          // Additional Stats
          completionStats,

          // 9. Task completion trend (last 7 days)
          taskCompletionTrend,

          // 10. Activity heatmap (last 30 days)
          activityHeatmap,

          // 11. Top collaborators
          topCollaborators,
        },
      };
    } catch (err) {
      console.error('Error in getUserDashboardData:', err);
      throw new UnauthorizedException('Could not fetch user dashboard data');
    }
  }

  /**
   * Get user's owned projects with sanitized data
   */
  private async getOwnedProjects(userId: number): Promise<any[]> {
    const projects = await this.projectRepository.find({
      where: { user: { id: userId } },
      relations: [
        'user',
        'categories',
        'tags',
        'projectPeers',
        'projectPeers.user',
        'statuses',
        'tasks',
        'tasks.status',
      ],
      order: { created_at: 'DESC' },
    });

    return this.sanitizeProjects(projects);
  }

  /**
   * Get projects where user is a peer
   */
  private async getPeerProjects(userId: number): Promise<any[]> {
    const projectPeers = await this.projectPeerRepository.find({
      where: { user: { id: userId } },
      relations: [
        'project',
        'project.user',
        'project.categories',
        'project.tags',
        'project.statuses',
        'project.tasks',
        'project.tasks.status',
      ],
    });

    const projects = projectPeers.map((pp) => pp.project);
    return this.sanitizeProjects(projects);
  }

  /**
   * Get project status distribution for pie chart
   */
  private async getProjectStatusDistribution(userId: number): Promise<any> {
    // Get all project IDs (owned + peer)
    const projectIds = await this.getAllUserProjectIds(userId);

    const statusCountsRaw = await this.projectRepository
      .createQueryBuilder('project')
      .select('project.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('project.id IN (:...projectIds)', { projectIds })
      .groupBy('project.status')
      .getRawMany();

    // Map to required format

    const distribution = statusCountsRaw.map((row) => ({
      name: statusLabels[row.status] || row.status,
      value: parseInt(row.count),
      color: statusColors[row.status] || '#6b7280',
      status: row.status,
    }));

    return distribution;
  }

  /**
   * Get tasks grouped by project and status (for stacked bar chart)
   */
  private async getTasksByProject(userId: number): Promise<any> {
    const projectIds = await this.getAllUserProjectIds(userId);

    // Get top 6 projects by task count with their statuses
    const topProjects = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.tasks', 'task')
      .leftJoinAndSelect('project.statuses', 'statuses')
      .select('project.id', 'projectId')
      .addSelect('project.title', 'projectTitle')
      .addSelect('COUNT(task.id)', 'taskCount')
      .where('project.id IN (:...projectIds)', { projectIds })
      .groupBy('project.id')
      .orderBy('COUNT(task.id)', 'DESC')
      .limit(10)
      .getRawMany();

    // Get full project details to access statuses
    const projectsWithStatuses = await this.projectRepository.find({
      where: { id: In(topProjects.map((p) => p.projectId)) },
      relations: ['statuses'],
    });

    // Collect all unique status titles across all projects
    const allStatusTitles = new Set<string>();
    projectsWithStatuses.forEach((project) => {
      project.statuses?.forEach((status) => {
        allStatusTitles.add(status.title);
      });
    });

    // For each project, get task counts by their custom statuses
    const tasksData = await Promise.all(
      topProjects.map(async (project) => {
        const projectWithStatuses = projectsWithStatuses.find(
          (p) => p.id === project.projectId,
        );

        // Get task counts for this project's statuses
        const statusCounts = await this.taskRepository
          .createQueryBuilder('task')
          .leftJoin('task.status', 'status')
          .select('status.id', 'statusId')
          .addSelect('status.title', 'statusTitle')
          .addSelect('COUNT(task.id)', 'count')
          .where('task.project_id = :projectId', {
            projectId: project.projectId,
          })
          .groupBy('status.id')
          .addGroupBy('status.title')
          .getRawMany();

        // Build result object with project's statuses
        const result: any = {
          projectId: project.projectId,
          projectTitle: project.projectTitle,
          totalTasks: parseInt(project.taskCount) || 0,
        };

        // Initialize all statuses for this project to 0
        projectWithStatuses?.statuses?.forEach((status) => {
          const statusKey = this.sanitizeStatusKey(status.title);
          result[statusKey] = 0;
        });

        // Fill in actual counts
        statusCounts.forEach((sc) => {
          const statusKey = this.sanitizeStatusKey(sc.statusTitle);
          result[statusKey] = parseInt(sc.count) || 0;
        });

        // Store status metadata for frontend rendering
        result._statusMeta =
          projectWithStatuses?.statuses?.map((status) => ({
            id: status.id,
            title: status.title,
            key: this.sanitizeStatusKey(status.title),
            color: status.color || this.getDefaultStatusColor(status.title),
          })) || [];

        return result;
      }),
    );

    // Build a map of all statuses with their colors across all projects
    const statusMap = new Map<string, { title: string; color: string }>();
    projectsWithStatuses.forEach((project) => {
      project.statuses?.forEach((status) => {
        if (!statusMap.has(status.title)) {
          statusMap.set(status.title, {
            title: status.title,
            color: status.color,
          });
        }
      });
    });

    // Return data with metadata for chart rendering
    return {
      projects: tasksData,
      allStatuses: Array.from(statusMap.values()).map((status) => ({
        title: status.title,
        key: this.sanitizeStatusKey(status.title),
        color: status.color,
      })),
    };
  }

  /**
   * Helper: Sanitize status title to use as object key
   * Converts "In Progress" -> "inProgress", "To Do" -> "toDo"
   */
  private sanitizeStatusKey(statusTitle: string): string {
    if (!statusTitle) return 'unknown';

    return statusTitle
      .toLowerCase()
      .split(' ')
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join('');
  }

  /**
   * Helper: Get default color for common status names
   */
  private getDefaultStatusColor(statusTitle: string): string {
    const lowerTitle = statusTitle?.toLowerCase() || '';

    if (lowerTitle.includes('done') || lowerTitle.includes('complete')) {
      return '#10b981'; // green
    } else if (
      lowerTitle.includes('progress') ||
      lowerTitle.includes('doing')
    ) {
      return '#3b82f6'; // blue
    } else if (lowerTitle.includes('review')) {
      return '#8b5cf6'; // purple
    } else if (lowerTitle.includes('todo') || lowerTitle.includes('to do')) {
      return '#6b7280'; // gray
    } else if (lowerTitle.includes('blocked') || lowerTitle.includes('hold')) {
      return '#ef4444'; // red
    } else if (lowerTitle.includes('test')) {
      return '#f59e0b'; // orange
    }

    // Default color
    return '#94a3b8'; // slate
  }

  /**
   * Get recent activities across all user projects
   */
  private async getRecentActivities(userId: number): Promise<any[]> {
    const projectIds = await this.getAllUserProjectIds(userId);

    const activities = await this.projectActivityRepository.find({
      where: { projectId: In(projectIds) },
      relations: ['user', 'project'],
      order: { createdAt: 'DESC' },
      take: 6,
    });

    return activities.map((activity) => ({
      id: activity.id,
      type: activity.activityType,
      description: activity.description,
      entityType: activity.entityType,
      entityId: activity.entityId,
      user: {
        id: activity.user?.id,
        full_name: activity.user?.fullName,
        email: activity.user?.email,
        avatar: activity.user?.avatar,
      },
      project: {
        id: activity.project?.id,
        title: activity.project?.title,
      },
      createdAt: activity.createdAt,
      timeAgo: moment(activity.createdAt).fromNow(),
    }));
  }

  /**
   * Get active projects count
   */
  private async getActiveProjectsCount(userId: number): Promise<number> {
    const projectIds = await this.getAllUserProjectIds(userId);

    return await this.projectRepository.count({
      where: {
        id: In(projectIds),
        status: In([ProjectStatus.ACTIVE, ProjectStatus.IN_PROGRESS]),
      },
    });
  }

  /**
   * Get completion statistics
   */
  private async getCompletionStats(userId: number): Promise<any> {
    const projectIds = await this.getAllUserProjectIds(userId);

    const totalTasks = await this.taskRepository.count({
      where: { project: { id: In(projectIds) } },
    });

    const completedTasks = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoin('task.status', 'status')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('LOWER(status.title) = :status', { status: 'done' })
      .getCount();

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      completionRate,
      pendingTasks: totalTasks - completedTasks,
    };
  }

  /**
   * Get overdue tasks count
   */
  private async getOverdueTasks(userId: number): Promise<number> {
    const projectIds = await this.getAllUserProjectIds(userId);
    const now = new Date();

    return await this.taskRepository
      .createQueryBuilder('task')
      .leftJoin('task.status', 'status')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.due_date < :now', { now })
      .andWhere('LOWER(status.title) != :done', { done: 'done' })
      .getCount();
  }

  /**
   * Get upcoming deadlines count (tasks due in next 7 days)
   */
  private async getUpcomingDeadlines(userId: number): Promise<number> {
    const projectIds = await this.getAllUserProjectIds(userId);
    const now = new Date();
    const sevenDaysLater = addDays(now, 7);

    return await this.taskRepository
      .createQueryBuilder('task')
      .leftJoin('task.status', 'status')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.due_date >= :now', { now })
      .andWhere('task.due_date <= :sevenDaysLater', { sevenDaysLater })
      .andWhere('LOWER(status.title) != :done', { done: 'done' })
      .getCount();
  }

  /**
   * Get active members count across all projects
   */
  private async getActivePeers(userId: number): Promise<number> {
    const projectIds = await this.getAllUserProjectIds(userId);
    const sevenDaysAgo = addDays(new Date(), -7);

    const activeUserIds = await this.projectActivityRepository
      .createQueryBuilder('pa')
      .select('DISTINCT pa.userId', 'userId')
      .where('pa.projectId IN (:...projectIds)', { projectIds })
      .andWhere('pa.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .getRawMany();

    return activeUserIds.length;
  }

  /**
   * Calculate project trend (last 30 days vs previous 30 days)
   */
  private async calculateProjectTrend(userId: number): Promise<number> {
    const now = new Date();
    const thirtyDaysAgo = addDays(now, -30);
    const sixtyDaysAgo = addDays(now, -60);

    const currentPeriod = await this.projectRepository.count({
      where: {
        user: { id: userId },
        created_at: Between(thirtyDaysAgo, now),
      },
    });

    const previousPeriod = await this.projectRepository.count({
      where: {
        user: { id: userId },
        created_at: Between(sixtyDaysAgo, thirtyDaysAgo),
      },
    });

    return this.calculateTrendPercentage(currentPeriod, previousPeriod);
  }

  /**
   * Calculate task trend
   */
  private async calculateTaskTrend(userId: number): Promise<number> {
    const projectIds = await this.getAllUserProjectIds(userId);
    const now = new Date();
    const thirtyDaysAgo = addDays(now, -30);
    const sixtyDaysAgo = addDays(now, -60);

    const currentPeriod = await this.taskRepository.count({
      where: {
        project: { id: In(projectIds) },
        created_at: Between(thirtyDaysAgo, now),
      },
    });

    const previousPeriod = await this.taskRepository.count({
      where: {
        project: { id: In(projectIds) },
        created_at: Between(sixtyDaysAgo, thirtyDaysAgo),
      },
    });

    return this.calculateTrendPercentage(currentPeriod, previousPeriod);
  }

  /**
   * Get user peers with sanitized data
   */
  private async getUserPeers(userId: number): Promise<any[]> {
    const userPeers = await this.userPeerRepository.find({
      where: { user: { id: userId } },
      relations: ['user', 'peer'],
      take: 8,
    });

    return userPeers.map((userPeer) => ({
      ...userPeer,
      user: this.sanitizeUser(userPeer.user),
      peer: this.sanitizeUser(userPeer.peer),
    }));
  }

  /**
   * Helper: Get all project IDs where user is owner or peer
   */
  private async getAllUserProjectIds(userId: number): Promise<number[]> {
    // Owned projects
    const ownedProjects = await this.projectRepository.find({
      where: { user: { id: userId } },
      select: ['id'],
    });

    // Peer projects
    const peerProjects = await this.projectPeerRepository.find({
      where: { user: { id: userId } },
      relations: ['project'],
      select: ['id'],
    });

    const ownedIds = ownedProjects.map((p) => p.id);
    const peerIds = peerProjects.map((pp) => pp.project.id);

    return [...new Set([...ownedIds, ...peerIds])];
  }

  /**
   * Helper: Sanitize projects (remove sensitive data)
   */
  private sanitizeProjects(projects: any[]): any[] {
    return projects.map((project) => ({
      ...project,
      user: this.sanitizeUser(project.user),
      projectPeers: project.projectPeers?.map((peer) => ({
        ...peer,
        user: this.sanitizeUser(peer.user),
      })),
    }));
  }

  /**
   * Helper: Sanitize user data
   */
  private sanitizeUser(user: any): any {
    if (!user) return null;
    const { password, logged_in, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Helper: Calculate trend percentage
   */
  private calculateTrendPercentage(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  }

  async findUsersByUsernames(usernames: string[]): Promise<User[]> {
    if (!usernames.length) return [];
    return this.userRepository.find({
      where: { username: In(usernames) },
    });
  }

  /**
   * Get task completion trend for the last 7 days
   * Returns completed vs created tasks per day
   */
  private async getTaskCompletionTrend(userId: number): Promise<any[]> {
    const projectIds = await this.getAllUserProjectIds(userId);
    const now = new Date();
    const sevenDaysAgo = addDays(now, -7);

    // Get tasks completed in last 7 days
    const completedTasksRaw = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoin('task.status', 'status')
      .select('DATE(task.updated_at)', 'date')
      .addSelect('COUNT(task.id)', 'count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('LOWER(status.title) = :done', { done: 'done' })
      .andWhere('task.updated_at >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy('DATE(task.updated_at)')
      .getRawMany();

    // Get tasks created in last 7 days
    const createdTasksRaw = await this.taskRepository
      .createQueryBuilder('task')
      .select('DATE(task.created_at)', 'date')
      .addSelect('COUNT(task.id)', 'count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.created_at >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy('DATE(task.created_at)')
      .getRawMany();

    // Build chart data for last 7 days
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDays(now, -i);
      const dateStr = moment(date).format('YYYY-MM-DD');
      const dayName = moment(date).format('ddd');

      const completed = completedTasksRaw.find((t) => {
        const taskDate = moment(t.date).format('YYYY-MM-DD');
        return taskDate === dateStr;
      });

      const created = createdTasksRaw.find((t) => {
        const taskDate = moment(t.date).format('YYYY-MM-DD');
        return taskDate === dateStr;
      });

      chartData.push({
        day: dayName,
        date: dateStr,
        completed: completed ? parseInt(completed.count) : 0,
        created: created ? parseInt(created.count) : 0,
      });
    }

    return chartData;
  }

  /**
   * Get activity heatmap for the last 30 days
   * Returns activity counts per day
   */
  private async getActivityHeatmap(userId: number): Promise<any[]> {
    const projectIds = await this.getAllUserProjectIds(userId);
    const now = new Date();
    const thirtyDaysAgo = addDays(now, -30);

    // Get all activities grouped by date
    const activitiesRaw = await this.projectActivityRepository
      .createQueryBuilder('pa')
      .select('DATE(pa.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('pa.projectId IN (:...projectIds)', { projectIds })
      .andWhere('pa.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy('DATE(pa.createdAt)')
      .getRawMany();

    // Build heatmap data for last 30 days
    const heatmapData = [];
    for (let i = 29; i >= 0; i--) {
      const date = addDays(now, -i);
      const dateStr = moment(date).format('YYYY-MM-DD');
      const dayName = moment(date).format('ddd');
      const dayOfWeek = moment(date).day(); // 0 = Sunday, 6 = Saturday

      const activity = activitiesRaw.find((a) => {
        const activityDate = moment(a.date).format('YYYY-MM-DD');
        return activityDate === dateStr;
      });

      heatmapData.push({
        date: dateStr,
        day: dayName,
        dayOfWeek,
        count: activity ? parseInt(activity.count) : 0,
        intensity: this.calculateIntensity(
          activity ? parseInt(activity.count) : 0,
        ),
      });
    }

    return heatmapData;
  }

  /**
   * Helper: Calculate intensity level for heatmap (0-4)
   */
  private calculateIntensity(count: number): number {
    if (count === 0) return 0;
    if (count <= 5) return 1;
    if (count <= 10) return 2;
    if (count <= 20) return 3;
    return 4;
  }

  /**
   * Get top collaborators based on project activities
   * Returns users with most activities across all projects
   */
  private async getTopCollaborators(userId: number): Promise<any[]> {
    const projectIds = await this.getAllUserProjectIds(userId);
    const thirtyDaysAgo = addDays(new Date(), -30);

    // Get activity counts per user
    const collaboratorsRaw = await this.projectActivityRepository
      .createQueryBuilder('pa')
      .leftJoinAndSelect('pa.user', 'user')
      .select('user.id', 'userId')
      // .addSelect('user.fullName', 'fullName')
      .addSelect('user.first_name', 'first_name')
      .addSelect('user.last_name', 'last_name')
      .addSelect('user.email', 'email')
      .addSelect('user.avatar', 'avatar')
      .addSelect('COUNT(*)', 'activityCount')
      .where('pa.projectId IN (:...projectIds)', { projectIds })
      .andWhere('pa.userId != :currentUserId', { currentUserId: userId }) // Exclude current user
      .andWhere('pa.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy('user.id')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    // Get additional stats for each collaborator
    const collaborators = await Promise.all(
      collaboratorsRaw.map(async (collab) => {
        // Get task count
        const taskCount = await this.taskRepository
          .createQueryBuilder('task')
          .leftJoin('task.assignees', 'assignee')
          .where('task.project_id IN (:...projectIds)', { projectIds })
          .andWhere('assignee.id = :userId', { userId: collab.userId })
          .getCount();

        // Get comment count
        const commentCount = await this.projectActivityRepository.count({
          where: {
            projectId: In(projectIds),
            userId: collab.userId,
            activityType: ActivityType.PROJECT_COMMENT,
            createdAt: Between(thirtyDaysAgo, new Date()),
          },
        });

        // Calculate collaboration score
        const activityScore = Math.min(parseInt(collab.activityCount) / 50, 1);
        const taskScore = Math.min(taskCount / 20, 1);
        const commentScore = Math.min(commentCount / 30, 1);
        const collaborationScore = Math.round(
          (activityScore * 40 + taskScore * 35 + commentScore * 25) * 100,
        );

        return {
          userId: collab.userId,
          fullName: collab.first_name + ' ' + collab.last_name,
          email: collab.email,
          avatar: collab.avatar,
          activityCount: parseInt(collab.activityCount),
          taskCount,
          commentCount,
          collaborationScore,
        };
      }),
    );

    return collaborators;
  }

  // Optional helper if you want usernames to be lowercase always
  async findUsersByUsernamesCaseInsensitive(
    usernames: string[],
  ): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) IN (:...usernames)', {
        usernames: usernames.map((u) => u.toLowerCase()),
      })
      .getMany();
  }

  async findUsersByFullNames(fullNames: string[]): Promise<User[]> {
    if (!fullNames.length) return [];

    // Create a query builder
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    let paramIndex = 0;
    let orConditions = [];

    // Build conditions for each name
    for (const fullName of fullNames) {
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length === 0) continue;

      // First part is always first name
      const firstName = nameParts[0].toLowerCase();
      const firstNameParam = `firstName${paramIndex}`;

      if (nameParts.length === 1) {
        // Only first name
        orConditions.push(`LOWER(user.first_name) LIKE :${firstNameParam}`);
        queryBuilder.setParameter(firstNameParam, `%${firstName}%`);
      } else {
        // First name and last name
        const lastName = nameParts.slice(1).join(' ').toLowerCase();
        const lastNameParam = `lastName${paramIndex}`;

        orConditions.push(
          `(LOWER(user.first_name) LIKE :${firstNameParam} AND LOWER(user.last_name) LIKE :${lastNameParam})`,
        );
        queryBuilder.setParameter(firstNameParam, `%${firstName}%`);
        queryBuilder.setParameter(lastNameParam, `%${lastName}%`);
      }

      paramIndex++;
    }

    if (orConditions.length === 0) return [];

    // Combine all conditions with OR
    queryBuilder.where(orConditions.join(' OR '));

    return queryBuilder.getMany();
  }

  // In users.service.ts
  async getUsersByIds(ids: number[]): Promise<User[]> {
    if (!ids.length) return [];

    return this.userRepository.find({
      where: {
        id: In(ids),
      },
      select: [
        'id',
        'first_name',
        'last_name',
        'username',
        'email',
        'avatar',
        'logged_in',
      ],
    });
  }

  // async getUserDshboardData2(user: any): Promise<any> {
  //   try {
  //     const foundUser = await this.getUserAccountById(user.userId);

  //     if (!foundUser) {
  //       throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
  //     }

  //     const projects = await this.projectRepository.find({
  //       where: { user: foundUser },
  //       relations: [
  //         'user',
  //         'categories',
  //         'tags',
  //         'projectPeers',
  //         'projectPeers.user',
  //       ],
  //       take: 8,
  //       order: {
  //         created_at: 'DESC',
  //       },
  //     });

  //     console.log(projects, 'projects');

  //     const userPeers = await this.userPeerRepository.find({
  //       where: { user: foundUser },
  //       relations: ['user', 'peer'],
  //       take: 10,
  //     });

  //     // Initialize status counts
  //     const statusCounts: Record<string, number> = {};
  //     this.statusOptions.forEach((status) => {
  //       statusCounts[status] = 0;
  //     });

  //     // Count projects per status
  //     projects.forEach((project) => {
  //       const projectStatus = project.status?.toLowerCase();
  //       if (this.statusOptions.includes(projectStatus)) {
  //         statusCounts[projectStatus]++;
  //       }
  //     });

  //     // To return it in array form like [56, 79, 89, 7, 10] in statusOptions order
  //     const statusArray = this.statusOptions.map(
  //       (status) => statusCounts[status],
  //     );

  //     return {
  //       statusCounts, // object form
  //       statusArray, // array form
  //       projects,
  //       userPeers,
  //       success: 'success',
  //       message: 'Successfully fetched user dashboard data!',
  //     };
  //   } catch (err) {
  //     console.error('Error in getUserDshboardData:', err);
  //     throw new UnauthorizedException('Could not fetch user dashboard data');
  //   }
  // }
}
