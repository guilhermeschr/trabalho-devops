import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type InternalRequest = {
  headers: { 'x-internal-token'?: string };
};

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    const expected = this.configService.getOrThrow<string>(
      'INTERNAL_SERVICE_TOKEN',
    );
    const received = request.headers['x-internal-token'];

    if (!received || received !== expected) {
      throw new ForbiddenException('Token interno inválido');
    }

    return true;
  }
}
