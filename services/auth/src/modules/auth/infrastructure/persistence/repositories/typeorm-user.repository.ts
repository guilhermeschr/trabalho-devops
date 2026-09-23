import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRepository } from '../../../application/ports/auth.ports';
import {
  EmailAlreadyRegisteredError,
  NewUser,
  User,
} from '../../../domain/user';
import { UserOrmEntity } from '../entities/user.orm-entity';

export const AUTH_CONNECTION = 'auth';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity, AUTH_CONNECTION)
    private readonly repository: Repository<UserOrmEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repository.findOneBy({ email });
    return entity ? this.toDomain(entity) : null;
  }

  async create(user: NewUser): Promise<User> {
    const entity = this.repository.create({
      id: randomUUID(),
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: new Date(),
    });

    try {
      await this.repository.insert(entity);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }

    return this.toDomain(entity);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        UNIQUE_VIOLATION
    );
  }

  private toDomain(entity: UserOrmEntity): User {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      passwordHash: entity.passwordHash,
      createdAt: entity.createdAt,
    };
  }
}
