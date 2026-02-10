import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenExpiredError } from 'jsonwebtoken';
import { config } from '../../config/index';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.secret,
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    // console.log(user, payload, "user in jwt")
    if (!user || !user.is_active) {
      throw new UnauthorizedException();
    }

    const id = payload.sub ? payload.sub : payload.id;
    return {
      userId: id,
      email: payload.email,
      role: payload.role,
      // currentOrganizationId: payload.currentOrganizationId,
      userOrganizations: payload.userOrganizations,
      organizationRole: payload.organizationRole,
    };
  }

  handleRequest(err, user, info, context) {
    if (info instanceof TokenExpiredError) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}

// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// // import { AdminAccount } from 'src/admin/admin.model';
// // import { UserAccount } from 'src/users/models/user-account.schema';
// import { config } from '../../config/index';
// import { AuthService } from '../services/auth.service';
// import { User } from 'src/typeorm/entities/User';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor(private configService: ConfigService) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: config.secret,
//     });
//   }

//   async validate(payload: any){
//     payload = payload.sub ? payload.sub : payload.id;

//     // return this.authService.validate(payload);
//     return { userId: payload.sub, email: payload.email };

//   }
// }
