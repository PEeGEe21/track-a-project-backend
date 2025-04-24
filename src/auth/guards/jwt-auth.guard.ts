// auth/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { Request } from 'express';
// import { config } from 'src/config';

// @Injectable()
// export class JwtAuthGuard implements CanActivate {
//   constructor(private readonly jwtService: JwtService) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest<Request>();
//     const authHeader = request.headers['authorization'];

//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       throw new UnauthorizedException('No token or invalid format');
//     }

//     const token = authHeader.split(' ')[1];

//     console.log(token);
//     try {
//       const payload = await this.jwtService.verifyAsync(token, {
//         secret: process.env.JWT_ACCESS_TOKEN_SECRET,
//       });
//       console.log(payload, 'payload');

//       // Attach user payload to request if needed
//       request['user'] = payload;
//       return true;
//     } catch (err) {
//       console.log('JWT verification failed:', err.message, err);
//       throw new UnauthorizedException('Invalid or expired token');
//     }
//   }
// }
