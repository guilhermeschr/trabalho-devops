import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

type RequestWithUser = {
  headers: { authorization?: string };
  user?: Record<string, unknown>;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token JWT ausente');
    }

    try {
      request.user = this.jwtService.verify<Record<string, unknown>>(
        authorization.slice('Bearer '.length),
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        },
      );
      return true;
    } catch {
      throw new UnauthorizedException('Token JWT inválido');
    }
  }
}
