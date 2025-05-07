import {
  BadRequestException,
  ConflictException,
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
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeers';
import { CreateUserProfileDto } from '../dtos/create-profile-peer.dto';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UserPeerStatus } from 'src/utils/constants/userPeerEnums';
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
    if (user) return this.loginUser(user, password, false, null);
    return this.loginUser(user, password, false);
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

    const isCorrectPassword = await bcrypt.compare(password, userPassword);

    if (!isCorrectPassword) {
      throw new BadRequestException(
        'SignIn Failed!, Incorrect login credentials',
      );
    }
    // }
    let profileImage: any;

    let updateUser = null;

    const payload = {
      email: user.email,
      sub: user.id,
    };

    await this.setUserLoggedIn(user.id, true);
    const tokens = await this.getTokens(user.id, user.email);

    delete user.password;
    // user = portal && updateUser ? updateUser : user;

    return {
      // accessToken: this.jwt.sign(payload),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      success: 'success',
      message: 'Logged in successfully',
      user: {
        ...user,
      },
    };
  }

  async setUserLoggedIn(id: number, loggedIn: boolean) {
    const user = await this.userRepository.findOneById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userRepository.update(
      { id: id },
      { logged_in: loggedIn },
    );

    const userupdate = await this.userRepository.findOneById(id);

    return userupdate;
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

    const project = await this.projectsService.getProjectById(project_id);

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

      if (userdetails?.inviteCode) {
        await this.usersService.createUserPeer(userdetails?.inviteCode, user);
      }

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
      const tokens = await this.getTokens(user.id, user.email);

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

  async getTokens(userId: number, email: string) {
    try {
      const payload = { sub: userId, email };

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

      const tokens = await this.getTokens(payload.sub, payload.email);
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

      console.log(user, 'logged out user');
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
}
