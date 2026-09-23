import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type AuthenticatedUser = {
  userId: string;
  email?: string;
};

type RequestWithUser = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
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

    let claims: { sub?: unknown; email?: unknown };
    try {
      claims = this.jwtService.verify<{ sub?: unknown; email?: unknown }>(
        authorization.slice('Bearer '.length),
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Token JWT inválido');
    }

    if (typeof claims.sub !== 'string' || claims.sub.trim() === '') {
      throw new UnauthorizedException('Token JWT sem claim sub');
    }

    request.user = {
      userId: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : undefined,
    };
    return true;
  }
}

/** Usuário autenticado pelo JwtAuthGuard; o userId vem sempre do claim sub. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<RequestWithUser>().user!,
);
