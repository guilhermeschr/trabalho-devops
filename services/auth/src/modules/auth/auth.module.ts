import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from './application/ports/auth.tokens';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { UserOrmEntity } from './infrastructure/persistence/entities/user.orm-entity';
import { CreateUsersTable1720000000000 } from './infrastructure/persistence/migrations/1720000000000-create-users-table';
import {
  AUTH_CONNECTION,
  TypeOrmUserRepository,
} from './infrastructure/persistence/repositories/typeorm-user.repository';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token-issuer';
import { AuthController } from './presentation/http/auth.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forRootAsync({
      name: AUTH_CONNECTION,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: AUTH_CONNECTION,
        type: 'postgres' as const,
        host: configService.get<string>('AUTH_DB_HOST', 'localhost'),
        port: Number(configService.get<string>('AUTH_DB_PORT', '5432')),
        database: configService.get<string>('AUTH_DB_NAME', 'auth'),
        username: configService.get<string>('AUTH_DB_USER', 'auth'),
        password: configService.get<string>('AUTH_DB_PASSWORD', 'auth'),
        entities: [UserOrmEntity],
        migrations: [CreateUsersTable1720000000000],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([UserOrmEntity], AUTH_CONNECTION),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUseCase,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
  ],
})
export class AuthModule {}
