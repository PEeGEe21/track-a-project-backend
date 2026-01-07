import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenExpiredError } from 'jsonwebtoken';
import { config } from '../../config/index';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.secret,
    });
  }

  async validate(payload: any) {
    const id = payload.sub ? payload.sub : payload.id;
    return { userId: id, email: payload.email, role: payload.role };
  }

  handleRequest(err, user, info, context) {
    if (info instanceof TokenExpiredError) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    console.log(err, user)
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
