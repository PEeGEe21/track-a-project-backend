import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserParams,
  CreateUserPostParams,
  CreateUserProfileParams,
  UpdateUserParams,
} from '../../utils/types';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeers';
import { UpdateUserPasswordDto } from '../dtos/UpdateUserPassword.dto';
import { JwtService } from '@nestjs/jwt';
import { Project } from 'src/typeorm/entities/Project';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { randomBytes } from 'crypto';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { addDays, addHours } from 'date-fns';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { UserPeerStatus } from 'src/utils/constants/userPeerEnums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Project) private projectRespository: Repository<Project>,
    @InjectRepository(UserPeer)
    private userPeerRepository: Repository<UserPeer>,
    @InjectRepository(ProjectPeer)
    private projectPeerRepository: Repository<ProjectPeer>,
    @InjectRepository(UserPeerInvite)
    private userPeerInviteRepository: Repository<UserPeerInvite>,
    private jwtService: JwtService,
    private MailingService: MailingService,
    private notificationService: NotificationsService,
  ) {}

  async getUserAccountById(id: number): Promise<User | undefined> {
    const user = await this.userRepository.findOneBy({ id });

    console.log(user);
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    }

    return user;
  }

  async getUserAccountByEmail(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    console.log(user, email, 'userr');

    // if (!user) {
    //   throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    // }
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
  async sendPeerInvite(user: any, inviteData): Promise<any> {
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
                where: { user: foundUser, peer: foundPeer },
              })
            : null;

          console.log(foundPeer, existingPeer || foundUser?.email == email);
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
    invite_as,
    inviteCode,
    existingPeer,
  ): Promise<any> {
    let peerEmail;
    let eventLink;
    let peerAccount = false;
    // const inviteCode = this.generateInviteCode(); // Assuming you have this function

    // console.log(existingPeer, 'fkknd')
    // user already exists just not a peer
    if (foundPeer || existingPeer) {
      const payload = {
        recipient: existingPeer,
        sender: user,
        title: 'You received an invite',
        message: `${user?.email} sent you an invite to be his Peer`,
        type: 'peer_request',
      };

      // build payload
      await this.notificationService.createNotification(foundPeer, payload);
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

  async createUserPeer(inviteCode: string, newUser: User) {
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
      await this.notificationService.createNotification(newUser, payload);

      const payload2 = {
        recipient: newUser,
        sender: invitedBy,
        title: 'Peer Invite Acceptance',
        message: `You accepted an invite to be ${invitedBy}'s Peer`,
        type: 'peer_request',
      };

      await this.notificationService.createNotification(newUser, payload2);

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

  async rejectUserPeer(inviteCode: string, newUser: User) {
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

        await this.notifyInviter(invitedBy, newUser);

        await this.notifyRejecter(invitedBy, newUser);

        return { success: true };
      }
      return { success: true };
    } catch (err) {
      console.error('Error rejecting peer invite:', err);
      return { success: false, message: 'Failed to reject peer invite.' };
    }
  }

  async notifyInviter(invitedBy, newUser) {
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
    );
  }

  async notifyRejecter(invitedBy, newUser) {
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
    );
  }

  // get user profile
  async getUserProfile(user: any): Promise<any> {
    try {
      const foundUser = await this.getUserAccountById(user.userId);

      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      delete foundUser.password;

      return {
        success: true,
        data: foundUser,
      };
    } catch (err) {
      console.error('Error in getUserProfile:', err);
      throw new UnauthorizedException('Could not fetch user profile');
    }
  }

  statusOptions = ['upcoming', 'active', 'paused', 'completed', 'overdue'];
  // user dashboard data
  async getUserDshboardData(user: any): Promise<any> {
    try {
      const foundUser = await this.getUserAccountById(user.userId);

      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const projects = await this.projectRespository.find({
        where: { user: { id: foundUser.id } },
        relations: [
          'user',
          'categories',
          'tags',
          'projectPeers',
          'projectPeers.user',
        ],
        take: 8,
        order: {
          created_at: 'DESC',
        },
      });

      // Remove sensitive user data
      const cleanedProjects = projects.map((project) => {
        // Clean project.user
        let safeUser = null;
        if (project.user) {
          const { password, logged_in, created_at, updated_at, ...restUser } =
            project.user;
          safeUser = restUser;
        }

        // Clean projectPeers[].user
        const safeProjectPeers =
          project.projectPeers?.map((peer) => {
            if (peer.user) {
              const {
                password,
                logged_in,
                created_at,
                updated_at,
                ...restPeerUser
              } = peer.user;
              return {
                ...peer,
                user: restPeerUser,
              };
            }
            return peer;
          }) || [];

        // VERY IMPORTANT: this return!
        return {
          ...project,
          user: safeUser,
          projectPeers: safeProjectPeers,
        };
      });

      const userPeers = await this.userPeerRepository.find({
        where: { user: { id: foundUser.id } },
        relations: ['user', 'peer'],
        take: 8,
      });

      // Also sanitize the userPeers data
      const sanitizedUserPeers = JSON.parse(JSON.stringify(userPeers)).map(
        (userPeer) => {
          if (userPeer.user) {
            const {
              password,
              logged_in,
              created_at,
              updated_at,
              deleted_at,
              ...safeUserData
            } = userPeer.user;
            userPeer.user = safeUserData;
          }

          if (userPeer.peer) {
            const {
              password,
              logged_in,
              created_at,
              updated_at,
              deleted_at,
              ...safePeerData
            } = userPeer.peer;
            userPeer.peer = safePeerData;
          }

          return userPeer;
        },
      );

      // Initialize status counts
      const statusCounts: Record<string, number> = {};
      this.statusOptions.forEach((status) => {
        statusCounts[status] = 0;
      });

      // Count projects per status
      projects.forEach((project) => {
        const projectStatus = project.status?.toLowerCase();
        if (this.statusOptions.includes(projectStatus)) {
          statusCounts[projectStatus]++;
        }
      });

      // To return it in array form like [56, 79, 89, 7, 10] in statusOptions order
      const statusArray = this.statusOptions.map(
        (status) => statusCounts[status],
      );

      return {
        statusCounts,
        statusArray,
        projects: cleanedProjects,
        userPeers: sanitizedUserPeers,
        success: 'success',
        message: 'Successfully fetched user dashboard data!',
      };
    } catch (err) {
      console.error('Error in getUserDshboardData:', err);
      throw new UnauthorizedException('Could not fetch user dashboard data');
    }
  }

  async getUserDshboardData2(user: any): Promise<any> {
    try {
      const foundUser = await this.getUserAccountById(user.userId);

      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const projects = await this.projectRespository.find({
        where: { user: foundUser },
        relations: [
          'user',
          'categories',
          'tags',
          'projectPeers',
          'projectPeers.user',
        ],
        take: 8,
        order: {
          created_at: 'DESC',
        },
      });

      console.log(projects, 'projects');

      const userPeers = await this.userPeerRepository.find({
        where: { user: foundUser },
        relations: ['user', 'peer'],
        take: 10,
      });

      // Initialize status counts
      const statusCounts: Record<string, number> = {};
      this.statusOptions.forEach((status) => {
        statusCounts[status] = 0;
      });

      // Count projects per status
      projects.forEach((project) => {
        const projectStatus = project.status?.toLowerCase();
        if (this.statusOptions.includes(projectStatus)) {
          statusCounts[projectStatus]++;
        }
      });

      // To return it in array form like [56, 79, 89, 7, 10] in statusOptions order
      const statusArray = this.statusOptions.map(
        (status) => statusCounts[status],
      );

      return {
        statusCounts, // object form
        statusArray, // array form
        projects,
        userPeers,
        success: 'success',
        message: 'Successfully fetched user dashboard data!',
      };
    } catch (err) {
      console.error('Error in getUserDshboardData:', err);
      throw new UnauthorizedException('Could not fetch user dashboard data');
    }
  }
}
