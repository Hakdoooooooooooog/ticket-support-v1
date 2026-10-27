import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or missing authentication token');
    }
    return user as TUser;
  }
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(_err: any, user: any): TUser {
    return (user || null) as TUser;
  }

  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
