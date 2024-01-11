import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// import { AdminAccount } from 'src/admin/admin.model';
// import { UserAccount } from 'src/users/models/user-account.schema';
import { config } from '../../config/index';
import { AuthService } from '../services/auth.service';
import { User } from 'src/typeorm/entities/User';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.secret,
    });
  }

  async validate(payload: any): Promise<User | undefined> {
    console.log(payload, 'pp');

    payload = payload.sub ? payload.sub : payload.id;

    return this.authService.validate(payload);
  }
}
