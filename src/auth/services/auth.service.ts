import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { isEmail } from 'class-validator';
import { randomBytes } from 'crypto';
import { any } from 'joi';
import * as moment from 'moment';
import { use } from 'passport';
// import { AdminAccount, AdminAccountDocument } from 'src/admin/admin.model';
// import { AdminService } from 'src/admin/admin.service';
import { config } from '../../config/index';
// import { userRoles } from '../../users/models/roles.enum';
// import {
//   UserAccount,
//   UserAccountDocument,
// } from '../../users/models/user-account.schema';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import {
  CreateUserParams,
  CreateUserPostParams,
  CreateUserProfileParams,
  UpdateUserParams,
} from '../../utils/types';
import { UsersService } from '../../users/services/users.service';
import { EmailLoginDto } from '../dtos/email-login.dto';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { PasswordResetWithCodeDto } from '../dtos/password-reset-with-code.dto';
import { PasswordResetDto } from '../dtos/password-reset.dto';
import { RequestOtpDto } from '../dtos/request-otp.dto';
import { RequestEmailOtpDto } from '../dtos/request-email-otp.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { SignUpResponseDto } from '../dtos/signup-response.dto';
import { User } from 'src/typeorm/entities/User';
import { PeerSignupResponseDto } from '../dtos/peer-signup-response.dto';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectsService } from 'src/projects/services/projects.service';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { CreateUserProfileDto } from '../dtos/create-profile-peer.dto';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UserPeerStatus } from '../../utils/constants/userPeerEnums';
import { UserRole } from 'src/utils/constants/user_roles';
import { CreateOrganizationSignUpDto } from '../dtos/create-organization-signup.dto';
import { Organization } from 'src/typeorm/entities/Organization';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { JoinOrganizationSignUpDto } from '../dtos/join-organization-signup.dto';
import { OrganizationInvitation } from 'src/typeorm/entities/OrganizationInvitation';
import { LoginDto } from '../dtos/login.dto';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
// import {
//   EmailVerification,
//   EmailVerificationDocument,
// } from '../models/emailVerification.model';
// import {
//   PasswordRecovery,
//   PasswordRecoveryDocument,
// } from '../models/password-recovery.model';
// import {
//   OtpVerification,
//   OtpVerificationDocument,
// } from '../models/phoneVerification.model';

@Injectable()
export class AuthService {
  constructor(
    // @InjectRepository(OtpVerification) private otpRepository: Repository<OtpVerification>,
    // @InjectRepository(EmailVerification) private emailRepository: Repository<EmailVerification>,
    // @InjectRepository(PasswordRecovery) private passwordRepository: Repository<PasswordRecovery>,
    private usersService: UsersService,
    private projectsService: ProjectsService,

    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private userProfileRepository: Repository<Profile>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(ProjectPeer)
    private projectPeerRepository: Repository<ProjectPeer>,
    @InjectRepository(UserPeerInvite)
    private userPeerInviteRepository: Repository<UserPeerInvite>,
    @InjectRepository(UserPeer)
    private userPeerRepository: Repository<UserPeer>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(OrganizationInvitation)
    private orgInvitationRepository: Repository<OrganizationInvitation>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    // @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Post) private postRepository: Repository<Post>,
    private jwt: JwtService,
  ) {}

  // async resetPasswordWithRecoveryCode(
  //   passwordResetWithCodeDto: PasswordResetWithCodeDto,
  // ): Promise<boolean> {
  //   const passwordRecovery = await this.PasswordRecoveryModel.findOne({
  //     recoveryCode: passwordResetWithCodeDto.recoveryCode,
  //   }).exec();

  //   if (!passwordRecovery) {
  //     throw new UnauthorizedException('Invalid verification code!');
  //   }

  //   const password = await bcrypt.hash(
  //     passwordResetWithCodeDto.newPassword,
  //     10,
  //   );
  //   await this.UserAccountModel.findOneAndUpdate(
  //     { email: passwordRecovery.email },
  //     {
  //       password,
  //     },
  //   ).exec();
  //   await this.PasswordRecoveryModel.findByIdAndDelete(
  //     passwordRecovery.id,
  //   ).exec();
  //   return true;
  // }

  // async recoverPassword(email: string, host: string): Promise<boolean> {
  //   const recoveryCode = randomBytes(20).toString('hex');

  //   let existingRecovery = await this.PasswordRecoveryModel.findOne({
  //     email,
  //   }).exec();

  //   if (existingRecovery) {
  //     existingRecovery.recoveryCode = recoveryCode;
  //     existingRecovery.expires = moment()
  //       .add(config.passwordRecoveryTtl, 'hours')
  //       .toDate();
  //     await existingRecovery.save();
  //   } else {
  //     const recovery = new this.PasswordRecoveryModel({
  //       email,
  //       recoveryCode,
  //       expires: moment().add(config.passwordRecoveryTtl, 'hours').toDate(),
  //     });
  //     existingRecovery = await recovery.save();
  //   }

  //   const user = await this.usersService.getUserAccountByEmail(
  //     existingRecovery.email,
  //   );

  //   if (user) {
  //     try {
  //       await this.mailingService.sendPasswordRecoveryEmail(
  //         existingRecovery,
  //         user.firstName,
  //         host,
  //       );
  //     } catch (e) {
  //       console.log(
  //         `An error has occurred on sending Email Notification, ${e}`,
  //       );
  //     }
  //   } else {
  //     throw new BadRequestException('Email is not registered');
  //   }

  //   return true;
  // }

  // resetPassword(user: UserAccount, passwordResetDto: PasswordResetDto): void {
  //   throw new Error('Method not implemented.');
  // }

  // async sendConfirmationEmail(email: string): Promise<string> {
  //   if (!isEmail(email.trim())) {
  //     throw new BadRequestException('Invalid email address!');
  //   }
  //   const confirmationId = randomBytes(20).toString('hex');
  //   const user = await this.usersService.getUserAccountByEmail(email);
  //   if (!user || user.isConfirmed) {
  //     return 'Email already confirmed';
  //   }

  //   let existingConfirmation: EmailVerification =
  //     await this.EmailVerificationModel.findOne({ email: user.email }).exec();

  //   if (!existingConfirmation) {
  //     existingConfirmation = {
  //       email: user.email,
  //       confirmationCode: confirmationId,
  //       expires: moment().add(config.accountVerificationTtl, 'days').toDate(),
  //     };
  //   }
  //   let createdConfirmation = new this.EmailVerificationModel(
  //     existingConfirmation,
  //   );
  //   createdConfirmation = await createdConfirmation.save();
  //   this.mailingService.sendConfirmationEmail(
  //     createdConfirmation,
  //     user.firstName,
  //   );
  //   return 'Successful';
  // }

  // async confirmEmail(
  //   confirmationCode: string,
  //   email: string,
  // ): Promise<boolean> {
  //   const confirmationCodeExists = await this.EmailVerificationModel.findOne({
  //     email,
  //   }).exec();

  //   if (!confirmationCodeExists) {
  //     throw new BadRequestException('Confirmation Code Does Not Exists!');
  //   }

  //   const user = await this.usersService.getUserAccountByEmail(
  //     confirmationCodeExists.email,
  //   );

  //   if (!user) {
  //     throw new BadRequestException(
  //       'User requesting email confirmation does not exist!',
  //     );
  //   }

  //   await this.UserAccountModel.findOneAndUpdate(
  //     { id: user.id },
  //     { isConfirmed: true },
  //   ).exec();

  //   this.EmailVerificationModel.deleteOne({
  //     id: confirmationCodeExists.id,
  //   });

  //   return true;
  // }

  // async resendSignupOtp(otpDto: RequestEmailOtpDto): Promise<boolean> {
  //   const user = await this.usersService.getUserAccountByEmail(
  //     otpDto.email,
  //   );
  //   console.log(user);
  //   if (user) {
  //     const otpCode = this.generateOtp();
  //     console.log(otpCode);
  //     const otpVerification = await this.OtpVerificationModel.findOne({
  //       phoneNumber: otpDto.phoneNumber,
  //     }).exec();
  //     if (!otpVerification) {
  //       return this.sendSignupOtp(otpDto);
  //     }
  //     otpVerification.otpCode = otpCode.toString();
  //     otpVerification.expires = moment().add(config.otpTtl, 'seconds').toDate();
  //     await otpVerification.save();
  //     await this.messagingService.sendOtpSMS(otpDto.phoneNumber, otpCode);
  //     await this.mailingService.send_email({
  //       email: user.email,
  //       firstName: user.firstName,
  //       otp: otpCode,
  //       template_id: config.send_otp_email,
  //     });
  //     return true;
  //   } else {
  //     return false;
  //   }
  // }

  // async sendSignupOtp(otpDto: RequestOtpDto): Promise<boolean> {
  //   const otpCode = this.generateOtp();
  //   let newOtpVerification: any = {
  //     phoneNumber: otpDto.phoneNumber,
  //     otpCode,
  //     expires: moment().add(config.otpTtl, 'seconds').toDate(),
  //   };
  //   newOtpVerification = new this.OtpVerificationModel(newOtpVerification);
  //   await newOtpVerification.save();
  //   await this.messagingService.sendOtpSMS(otpDto.phoneNumber, otpCode);
  //   return true;
  // }

  // async passwordlessLogin(
  //   passwordlessLoginDto: PasswordlessLoginDto,
  // ): Promise<LoginResponseDto> {
  //   const { otp, phoneNumber } = passwordlessLoginDto;
  //   await this.verifyOtp(otp, phoneNumber);
  //   const user =
  //     await this.usersService.getUserAccountByPhoneNumber(phoneNumber);
  //   return this.loginUser(user, null, true);
  // }

  // async loginWithPhoneNumber(
  //   loginDto: PhoneNumberLoginDto,
  // ): Promise<LoginResponseDto> {
  //   const { phoneNumber, password } = loginDto;
  //   const user =
  //     await this.usersService.getUserAccountByPhoneNumber(phoneNumber);

  //   return this.loginUser(user, password, false);
  // }

  async loginWithEmail(loginDto: EmailLoginDto): Promise<LoginResponseDto> {
    const { email, password } = loginDto;
    const user = await this.usersService.getUserAccountByEmail(email);
    console.log(loginDto, 'loginDto');
    if (user) return this.loginUser(user, password, false, null);
    return this.loginUser(user, password, false);
  }

  async loginWithAdmin(loginDto: EmailLoginDto): Promise<LoginResponseDto> {
    const { email, password } = loginDto;
    const user = await this.usersService.getUserAccountByEmail(email);
    if (!user) {
      throw new UnauthorizedException(
        'SignIn Failed!, Incorrect login credentials',
      );
    }
    if (user.role == UserRole.SUPER_ADMIN)
      return this.loginUser(user, password, false, null);
    else throw new UnauthorizedException('SignIn Failed! Not An Admin!!');
  }

  private async loginUser(
    user: any,
    password: string,
    passwordLess: boolean,
    portal = null,
  ): Promise<LoginResponseDto> {
    let passwordChanged = true;
    if (!user) {
      throw new UnauthorizedException(
        'SignIn Failed!, Incorrect login credentials',
      );
    }

    // await this.checkUserAccountEmailExists(user.email);

    // if (!passwordLess) {
    const userPassword = await this.usersService.getUserAccountPassword(
      user.email,
    );

    console.log(userPassword, password);

    const isCorrectPassword = await bcrypt.compare(password, userPassword);

    if (!isCorrectPassword) {
      throw new BadRequestException(
        'SignIn Failed!, Incorrect login credentials',
      );
    }
    // }
    let profileImage: any;

    console.log(
      user.id,
      user.email,
      user.role,
      'user.id, user.email, user.role',
    );
    await this.setUserLoggedIn(user.id, true);
    const tokens = await this.getTokens(user.id, user.email, user.role);

    delete user.password;

    if (user?.role == UserRole.SUPER_ADMIN) {
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        success: 'success',
        message: 'Logged in successfully',
        user: {
          ...user,
        },
      };
    }

    const userOrganizations = await this.usersService.getUserOrganizationsById(
      user.id,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      success: 'success',
      message: 'Logged in successfully',
      user: {
        ...user,
        organizations: userOrganizations,
      },
    };
  }

  async setUserLoggedIn(id: number, loggedIn: boolean) {
    const result = await this.userRepository.update(
      { id },
      { logged_in: loggedIn },
    );

    if (!result.affected) {
      throw new NotFoundException('User not found');
    }

    return this.userRepository.findOne({ where: { id } });
  }

  // sign up as peer
  async signupAsPeer(
    peerSignupDto: CreateUserDto,
    host: any,
    project_id: number,
  ): Promise<PeerSignupResponseDto> {
    peerSignupDto.email = peerSignupDto.email.toLowerCase();

    await this.checkUserAccountEmailExists(peerSignupDto.email);

    await this.checkUserAccountEmailExists(host);

    const user = await this.usersService.getUserAccountByEmail(host);

    const project = await this.projectsService.getProjectById(project_id, user);

    if (peerSignupDto.password) {
      const saltOrRounds = 10;
      peerSignupDto.password = await bcrypt.hash(
        peerSignupDto.password,
        saltOrRounds,
      );
    }

    const peer: any = await this.createUser(peerSignupDto);

    await this.createPeerAccount(peer, project, user);

    const payload = {
      email: peer.email,
      sub: peer.id,
    };

    return {
      accessToken: this.jwt.sign(payload),
      message: 'Logged in successfully',
      peer,
      project,
      user,
    };
  }

  async createPeerAccount(
    peerSignupDto: CreateUserDto,
    project: any,
    added_by: any,
  ): Promise<ProjectPeer> {
    const newUser = this.projectPeerRepository.create({
      ...peerSignupDto,
      project,
      addedBy: added_by,
    });
    return this.projectPeerRepository.save(newUser);

    // const newPeerUserAccount: User = await this.createPeerAccount(
    //   { ...peerSignupDto},
    //   false,
    // );
    // let newOutfitBuyerAccount: any = {
    //   userAccount: newUserAccount,
    // };
    // newOutfitBuyerAccount = new this.OutfitBuyerModel(newOutfitBuyerAccount);
    // return newOutfitBuyerAccount.save();
  }

  async generatePassword(length): Promise<any> {
    let result = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    console.log(result);
    return result;
  }

  async signUp(userdetails: CreateUserDto): Promise<SignUpResponseDto> {
    // console.log('herer')
    try {
      if (!userdetails.email || !userdetails.password) {
        throw new BadRequestException(`password and email fields are required`);
      }
      await this.checkUserAccountEmailExists(userdetails.email);
      // Rest of your signup logic

      if (userdetails.password) {
        const saltOrRounds = 10;
        userdetails.password = await bcrypt.hash(
          userdetails.password,
          saltOrRounds,
        );
      }
      // await this.checkUserAccountPhoneNumberExists(userdetails.phoneNumber);
      // await this.verifyOtp(userdetails.otp, userdetails.phoneNumber);
      const user: any = await this.createUser(userdetails);

      // if (userdetails?.inviteCode) {
      //   await this.usersService.createUserPeer(userdetails?.inviteCode, user);
      // }

      const userprofilepayload = {
        user: user,
        email: user.email,
        profile_created: 1,
        // phoneNumber: user.phoneNumber,
      };

      const userProfileDetails = await this.createUserProfile(
        user.id,
        userprofilepayload,
      );

      const payload = {
        email: user.email,
        sub: user.id,
      };

      user.profile = userProfileDetails;
      const profile = userProfileDetails;

      console.log(profile, 'profile details');
      await this.setUserLoggedIn(user.id, true);
      const tokens = await this.getTokens(user.id, user.email, user.role);

      console.log(tokens, 'rotke');
      // if (config.env === 'production') {
      //   const data = {
      //     env: 'Production',
      //     name: `${user.firstName} ${user.lastName}`,
      //     email: user.email,
      //     phone: user.phoneNumber,
      //   };
      //   await this.messagingService.userSignUpNotification(data);
      // }
      delete user.password;

      return {
        success: 'success',
        // accessToken: this.jwt.sign(payload),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user,
        profile: profile,
        message: 'Account was successfully created',
      };
    } catch (error) {
      console.error('Error in signup process:', error);
      throw error; // Re-throw to ensure it propagates
    }
  }

  createUser(userDetails: CreateUserDto) {
    const newUser = this.userRepository.create({
      ...userDetails,
      created_at: new Date(),
    });
    return this.userRepository.save(newUser);
  }

  async createUserPeer1(inviteCode: string, newUser: User) {
    const invite = await this.userPeerInviteRepository.findOne({
      where: { invite_code: inviteCode },
      relations: ['inviter_user_id'],
    });

    if (!invite) {
      throw new Error('Invalid invite code.');
    }

    const invitedBy = await this.usersService.getUserAccountById(
      invite.inviter_user_id.id,
    );

    if (invite.status !== 'accepted') {
      throw new Error(
        `Invite status is '${invite.status}', cannot create connection.`,
      );
    }

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

    // Save both at once (safest)
    await this.userPeerRepository.save([peerToUser, userToPeer]);

    return { peerToUser, userToPeer };
  }

  async createUserPeer2(inviteCode: string, newUser) {
    const invite = await this.userPeerInviteRepository.findOne({
      where: { invite_code: inviteCode },
      relations: ['inviter_user_id'],
    });

    if (!invite) {
      throw new Error('Invalid invite code.');
    }

    const invitedBy = await this.usersService.getUserAccountById(
      invite.inviter_user_id.id,
    );

    if (invite.status === 'accepted') {
      // const payload = {
      //   status: 'connected',
      //   connection_type: invite.invited_as,
      //   is_confirmed: true,
      //   user: { id: Number(invitedBy.id) }, // <-- only id
      //   peer: { id: Number(newUser.id) },   // <-- only id
      // };

      // const newUserPeer = this.userPeerRepository.create(payload);
      // return this.userPeerRepository.save(newUserPeer);
      const peerToUser = this.userPeerRepository.save({
        status: UserPeerStatus.CONNECTED,
        connection_type: invite.invited_as,
        is_confirmed: true,
        user: { id: invitedBy.id },
        peer: { id: newUser.id },
      });

      const userToPeer = this.userPeerRepository.save({
        status: UserPeerStatus.CONNECTED,
        connection_type: invite.invited_as,
        is_confirmed: true,
        user: { id: newUser.id },
        peer: { id: invitedBy.id },
      });
    } else {
      throw new Error(
        `Invite status is '${invite.status}', cannot create connection.`,
      );
    }
  }

  createUserProfile(user_id: number, userProfileDetails: CreateUserProfileDto) {
    const newUserProfile = this.userProfileRepository.create({
      ...userProfileDetails,
    });
    return this.userProfileRepository.save(newUserProfile);
  }

  private async checkUserAccountEmailExists(email: string): Promise<void> {
    const userAccountExists: boolean =
      await this.usersService.checkUserAccountEmailExists(email);
    if (userAccountExists) {
      throw new ConflictException(
        'An account with this email exists, use a different email',
      );
    }
  }

  // private async checkUserAccountPhoneNumberExists(
  //   phoneNumber: string,
  // ): Promise<void> {
  //   const userAccountExists: boolean =
  //     await this.usersService.checkUserAccountPhoneNumberExists(phoneNumber);
  //   if (userAccountExists) {
  //     throw new ConflictException(
  //       'An account with this phone number exists, use a different phone number',
  //     );
  //   }
  // }

  public generateOtp(): number {
    let otp = '';
    for (let i = 0; i < 4; i++) {
      const randomNum = Math.ceil(Math.random() * 9);
      otp += randomNum;
    }
    return parseInt(otp, 10);
  }

  async validate(id: number): Promise<any> {
    const user = await this.usersService.getUserAccountById(id);
    // ? await this.usersService.getUserAccountById(id)
    // : await this.AdminAccountModel.findById(id);
    if (!user) {
      throw new UnauthorizedException(`User with id ${id} does not exist!`);
    }
    return user;
  }

  // public async verifyOtp(otp: string, email: string): Promise<boolean> {
  //   const otpModel: otpRepository = await this.otpRepository.findOne({
  //     email,
  //   }).exec();
  //   if (otpModel === null) {
  //     throw new NotFoundException(
  //       'You have not requested an OTP or OTP has expired',
  //     );
  //   }
  //   if (moment().toDate() > otpModel.expires) {
  //     throw new NotFoundException('This OTP has expired');
  //   }

  //   if (otp !== otpModel.otpCode) {
  //     throw new NotFoundException('The OTP code is incorrect');
  //   }

  //   return true;
  // }
  // public async verifyOtp(otp: string, phoneNumber: string): Promise<boolean> {
  //   const otpModel: otpRepository = await this.otpRepository.findOne({
  //     phoneNumber,
  //   }).exec();
  //   if (otpModel === null) {
  //     throw new NotFoundException(
  //       'You have not requested an OTP or OTP has expired',
  //     );
  //   }
  //   if (moment().toDate() > otpModel.expires) {
  //     throw new NotFoundException('This OTP has expired');
  //   }

  //   if (otp !== otpModel.otpCode) {
  //     throw new NotFoundException('The OTP code is incorrect');
  //   }

  //   return true;
  // }

  // public async verifyEmail(confirmationCode: string): Promise<boolean> {
  //   const emailVerificationModel: EmailVerification =
  //     await this.EmailVerificationModel.findOne({
  //       confirmationCode,
  //     }).exec();
  //   if (emailVerificationModel === null) {
  //     throw new NotFoundException('Email already confirmed');
  //   }
  //   if (moment().toDate() > emailVerificationModel.expires) {
  //     throw new NotFoundException('Email Verification Link has expired');
  //   }

  //   const user = await this.UserAccountModel.findOneAndUpdate(
  //     { email: emailVerificationModel.email },
  //     { isConfirmed: true },
  //   ).exec();

  //   return true;
  // }

  private checkPasswordMatches(
    password: string,
    confirmPassword: string,
  ): boolean {
    if (password === confirmPassword) {
      return true;
    }
    throw new BadRequestException(
      `password and confirmPassword fields do not match`,
    );
  }

  // public async googleLogin(
  //   data: {
  //     firstName: string;
  //     lastName: string;
  //     email: string;
  //     accessToken: string;
  //   } | null,
  // ) {
  //   if (!data) {
  //     return {};
  //   }
  //   const user = await this.usersService.getUserAccountByEmail(data.email);
  //   if (user) {
  //     const dto = await this.loginUser(user, '', false);
  //     return { ...dto, action: 'login' };
  //   }

  //   await this.checkUserAccountEmailExists(user.email);
  //   const payload = {
  //     email: outfitBuyer.userAccount.email,
  //     sub: outfitBuyer.userAccount._id,
  //     phoneNumber: outfitBuyer.userAccount.phoneNumber,
  //   };

  //   await this.sendConfirmationEmail(outfitBuyerSignupDto.email);

  //   this.mailingService.UserSignUpEmail({
  //     email: outfitBuyerSignupDto.email,
  //     name: outfitBuyerSignupDto.firstName,
  //   });

  //   // //mail to event planer
  //   // if (outfitBuyerSignupDto.eventManager) {
  //   //   const dynamic_data = {
  //   //     email: outfitBuyerSignupDto.email,
  //   //     template_id: config.sendGrid.EVENT_PLANNER_WITHOUT_EVENT,
  //   //     subject: `Congratulations`,
  //   //     customerName: outfitBuyerSignupDto.firstName,
  //   //     url: `http://localhost:3000/auth?active=login`,
  //   //   };
  //   //   this.mailingService.send_email(dynamic_data);
  //   // }

  //   return {
  //     accessToken: this.jwt.sign(payload),
  //     action: 'signup',
  //     outfitBuyer,
  //   };
  //   return { ...data, action: 'signup' };
  // }

  public async facebookLogin(req) {
    if (!req.user) {
      return {};
    }
    return req;
  }

  // async socialSignUp(
  //   outfitBuyerSignupDto: OutfitBuyerSignupDto,
  //   host: string,
  // ): Promise<{ accessToken: string; outfitBuyer: any }> {
  //   await this.checkUserAccountEmailExists(outfitBuyerSignupDto.email);
  //   await this.checkUserAccountPhoneNumberExists(
  //     outfitBuyerSignupDto.phoneNumber,
  //   );
  //   const outfitBuyer: any =
  //     await this.usersService.createOutfitBuyer(outfitBuyerSignupDto);
  //   const payload = {
  //     email: outfitBuyer.userAccount.email,
  //     sub: outfitBuyer.userAccount._id,
  //     phoneNumber: outfitBuyer.userAccount.phoneNumber,
  //   };

  //   await this.sendConfirmationEmail(outfitBuyerSignupDto.email);

  //   //
  //   this.mailingService.UserSignUpEmail({
  //     email: outfitBuyerSignupDto.email,
  //     name: outfitBuyerSignupDto.firstName,
  //   });

  //   //mail to event planer
  //   if (outfitBuyerSignupDto.eventManager) {
  //     const dynamic_data = {
  //       email: outfitBuyerSignupDto.email,
  //       template_id: config.sendGrid.EVENT_PLANNER_WITHOUT_EVENT,
  //       subject: `Congratulations`,
  //       customerName: outfitBuyerSignupDto.firstName,
  //       url: `${host}/auth?active=login`,
  //     };
  //     this.mailingService.send_email(dynamic_data);
  //   }

  //   // add user to details list
  //   this.klaviyoService.addMembertoList(
  //     outfitBuyerSignupDto.email,
  //     outfitBuyerSignupDto.phoneNumber,
  //     config.klaviyo.GroupsId,
  //     outfitBuyerSignupDto.firstName,
  //     outfitBuyerSignupDto.lastName,
  //   );
  //   this.klaviyoService.addMembertoList(
  //     outfitBuyerSignupDto.email,
  //     outfitBuyerSignupDto.phoneNumber,
  //     config.klaviyo.generalId,
  //     outfitBuyerSignupDto.firstName,
  //     outfitBuyerSignupDto.lastName,
  //   );

  //   if (config.env === 'production') {
  //     const data = {
  //       env: 'Production',
  //       name: `${outfitBuyerSignupDto.firstName} ${outfitBuyerSignupDto.lastName}`,
  //       email: outfitBuyerSignupDto.email,
  //       phone: outfitBuyerSignupDto.phoneNumber,
  //     };
  //     await this.messagingService.outfitBuyerSignUpNotification(data);
  //   }

  //   return {
  //     accessToken: this.jwt.sign(payload),
  //     outfitBuyer,
  //   };
  // }

  async getTokens(userId: number, email: string, role: string = 'member') {
    try {
      const userOrganizations =
        (await this.usersService.getUserOrganizationsById(userId)) ?? [];

      const payload = {
        sub: userId,
        email,
        role: role,
        portal: role === UserRole.SUPER_ADMIN ? 'admin' : 'user',
        userOrganizations: userOrganizations.map((uo) => ({
          organization_id: uo.organization_id,
          subscription_tier: uo.organization?.subscription_tier ?? null,
        })),
      };

      const accessToken = await this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
      });

      const refreshToken = await this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      });

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async hashRefreshToken(refreshToken: string) {
    const saltOrRounds = 10;
    return await bcrypt.hash(refreshToken, saltOrRounds);
  }

  // auth.controller.ts
  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET,
      });

      const tokens = await this.getTokens(
        payload.sub,
        payload.email,
        payload.role,
      );
      return {
        success: 'success',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // log out
  async logOut(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET,
      });

      const user = await this.getUserAccountById(payload.sub);
      if (!user)
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

      await this.setUserLoggedIn(user.id, false);

      return {
        success: 'success',
        message: 'Logged out successfully',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserAccountById(id: number): Promise<User | undefined> {
    const user = await this.userRepository.findOneBy({ id });

    console.log(user);
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    }

    return user;
  }

  // new sign up

  // auth.service.ts
  async switchOrganization(user: any, organizationId: string) {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    // Verify user is actually a member of the target organization
    const membership = await this.userOrganizationRepository.findOne({
      where: {
        user_id: userFound.id,
        organization_id: organizationId,
        is_active: true,
      },
      relations: ['organization'],
    });

    if (!membership) {
      throw new HttpException(
        'You are not a member of this organization',
        HttpStatus.FORBIDDEN,
      );
    }

    // Issue new JWT scoped to the new organization
    const token = await this.generateToken(
      userFound,
      membership.organization,
      membership.role,
    );

    return {
      success: true,
      token,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
      },
    };
  }

  /**
   * SCENARIO A: Sign up with new organization (becomes ORG_ADMIN)
   */
  async signUpWithOrganization(dto: CreateOrganizationSignUpDto) {
    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Generate unique slug from organization name
    const slug = await this.generateUniqueSlug(dto.organization_name);

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Start transaction
    const queryRunner =
      this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create user
      const user = queryRunner.manager.create(User, {
        email: dto.email,
        password: hashedPassword,
        first_name: dto.first_name,
        last_name: dto.last_name,
        username: dto.email.split('@')[0], // Generate username from email
        role: UserRole.MEMBER, // Default global role
        is_active: true,
      });
      await queryRunner.manager.save(user);

      // Create organization
      const organization = queryRunner.manager.create(Organization, {
        name: dto.organization_name,
        slug: slug,
        subscription_tier: SubscriptionTier.FREE,
        max_users: 5,
        max_projects: 10,
        is_active: true,
      });
      await queryRunner.manager.save(organization);

      // Create user-organization relationship (as ORG_ADMIN)
      const userOrganization = queryRunner.manager.create(UserOrganization, {
        user_id: user.id,
        organization_id: organization.id,
        role: OrganizationRole.ORG_ADMIN, // First user becomes admin
      });
      await queryRunner.manager.save(userOrganization);

      await queryRunner.commitTransaction();

      // Generate JWT token
      const token = await this.generateToken(
        user,
        organization,
        OrganizationRole.ORG_ADMIN,
      );

      return {
        user: this.sanitizeUser(user),
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          subscription_tier: organization.subscription_tier,
          role: userOrganization.role,
          onboarding_complete: organization.onboarding_complete,
          description: organization.description,
          logo: organization.logo,
        },
        token,
        message: 'Organization created successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * SCENARIO B: Sign up via invitation (joins existing organization)
   */
  async signUpWithInvitation(dto: JoinOrganizationSignUpDto) {
    // Validate invitation token
    const invitation = await this.orgInvitationRepository.findOne({
      where: { token: dto.invite_token, accepted: false },
      relations: ['organization'],
    });

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    // Check if invitation expired
    if (invitation.expires_at && new Date() > invitation.expires_at) {
      throw new BadRequestException('Invitation has expired');
    }

    // Verify email matches invitation
    if (invitation.email.toLowerCase() !== dto.email.toLowerCase()) {
      throw new BadRequestException('Email does not match invitation');
    }

    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check organization capacity
    const currentMemberCount = await this.userOrganizationRepository.count({
      where: { organization_id: invitation.organization_id },
    });

    if (currentMemberCount >= invitation.organization.max_users) {
      throw new BadRequestException(
        'Organization has reached maximum user capacity',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Start transaction
    const queryRunner =
      this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create user
      const user = queryRunner.manager.create(User, {
        email: dto.email,
        password: hashedPassword,
        first_name: dto.first_name,
        last_name: dto.last_name,
        username: dto.email.split('@')[0],
        role: UserRole.MEMBER,
        is_active: true,
      });
      await queryRunner.manager.save(user);

      // Create user-organization relationship
      const userOrganization = queryRunner.manager.create(UserOrganization, {
        user_id: user.id,
        organization_id: invitation.organization_id,
        role: invitation.invited_role, // Role from invitation
      });
      await queryRunner.manager.save(userOrganization);

      // Mark invitation as accepted
      invitation.accepted = true;
      await queryRunner.manager.save(invitation);

      await queryRunner.commitTransaction();

      // Generate JWT token
      const token = await this.generateToken(
        user,
        invitation.organization,
        invitation.invited_role,
      );

      return {
        user: this.sanitizeUser(user),
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
          subscription_tier: invitation.organization.subscription_tier,
          role: userOrganization.role,
          onboarding_complete: invitation.organization.onboarding_complete,
          description: invitation.organization.description,
          logo: invitation.organization.logo,
        },
        token,
        message: 'Successfully joined organization',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Login - handles both single and multi-organization scenarios
   */
  async login(dto: LoginDto) {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['user_organizations', 'user_organizations.organization'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Get user's organizations
    const userOrganizations = user.user_organizations.filter(
      (uo) => uo.organization.is_active,
    );

    if (userOrganizations.length === 0) {
      throw new UnauthorizedException('No active organization found');
    }

    // Determine which organization to use
    let selectedUserOrg: UserOrganization;

    if (userOrganizations.length === 1) {
      // Single organization - auto-select
      selectedUserOrg = userOrganizations[0];
    } else {
      // Multiple organizations
      if (!dto.organization_id) {
        // Return list of organizations for user to choose
        return {
          requiresOrganizationSelection: true,
          organizations: userOrganizations.map((uo) => ({
            id: uo.organization.id,
            name: uo.organization.name,
            slug: uo.organization.slug,
            subscription_tier: uo.organization.subscription_tier,
            role: uo.role,
            onboarding_complete: uo.organization.onboarding_complete,
            description: uo.organization.description,
            logo: uo.organization.logo,
          })),
        };
      }

      // Find the selected organization
      selectedUserOrg = userOrganizations.find(
        (uo) => uo.organization_id === dto.organization_id,
      );

      if (!selectedUserOrg) {
        throw new BadRequestException('Invalid organization selected');
      }
    }

    // Update logged_in status
    user.logged_in = true;
    await this.userRepository.save(user);

    // Generate JWT token
    const token = await this.generateToken(
      user,
      selectedUserOrg.organization,
      selectedUserOrg.role,
    );

    console.log(token, 'tokentoken');

    return {
      user: this.sanitizeUser(user),
      organization: {
        id: selectedUserOrg.organization.id,
        name: selectedUserOrg.organization.name,
        slug: selectedUserOrg.organization.slug,
        subscription_tier: selectedUserOrg.organization.subscription_tier,
        role: selectedUserOrg.role,
        onboarding_complete: selectedUserOrg.organization.onboarding_complete,
        description: selectedUserOrg.organization.description,
        logo: selectedUserOrg.organization.logo,
      },
      organizationRole: selectedUserOrg.role,
      allOrganizations: userOrganizations.map((uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        slug: uo.organization.slug,
        subscription_tier: uo.organization.subscription_tier,
        role: uo.role,
        onboarding_complete: uo.organization.onboarding_complete,
        description: uo.organization.description,
        logo: uo.organization.logo,
      })),
      token,
    };
  }

  /**
   * Validate invitation token (for frontend to check before signup)
   */
  async validateInvitation(token: string) {
    const invitation = await this.orgInvitationRepository.findOne({
      where: { token, accepted: false },
      relations: ['organization'],
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation token');
    }

    if (invitation.expires_at && new Date() > invitation.expires_at) {
      throw new BadRequestException('Invitation has expired');
    }

    return {
      email: invitation.email,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
      },
      invited_role: invitation.invited_role,
    };
  }

  /**
   * Helper: Generate unique slug from organization name
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let counter = 1;
    let uniqueSlug = slug;

    while (
      await this.organizationRepository.findOne({ where: { slug: uniqueSlug } })
    ) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  /**
   * Helper: Generate JWT token
   */
  private async generateToken(
    user: User,
    organization: Organization,
    organizationRole: OrganizationRole,
  ) {
    const userOrganizations =
      (await this.usersService.getUserOrganizationsById(user.id)) ?? [];

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      portal: user.role === UserRole.SUPER_ADMIN ? 'admin' : 'user',
      currentOrganizationId: organization.id,
      organizationRole: organizationRole, // Role within current org
      userOrganizations: userOrganizations.map((uo) => ({
        organization_id: uo.organization_id,
        subscription_tier: uo.organization?.subscription_tier ?? null,
        role: uo.role ?? null,
      })),
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_TOKEN_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_TOKEN_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    });

    console.log(accessToken, 'accessToken');
    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Helper: Remove sensitive data from user object
   */
  private sanitizeUser(user: User) {
    const { password, authStrategy, ...sanitized } = user;
    return sanitized;
  }

  // ── User Impersonation ────────────────────────────────────────────────────
  async impersonateUser(targetUserId: number, adminUserId: number) {
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['user_organizations', 'user_organizations.organization'],
    });

    const admin = await this.userRepository.findOne({
      where: { id: adminUserId },
    });

    if (!user) throw new ForbiddenException('User not found');

    // Log the impersonation
    await this.auditLogRepository.save({
      action: 'IMPERSONATE_USER',
      admin_id: adminUserId,
      admin: admin,
      target_user_id: targetUserId,
      target_user: user,
      metadata: { user_email: user.email },
    });

    // Generate token for impersonated user
    const firstOrg = user.user_organizations[0];
    const token = await this.generateToken(
      user,
      firstOrg.organization,
      firstOrg.role,
    );

    return { user, token };
  }
}
