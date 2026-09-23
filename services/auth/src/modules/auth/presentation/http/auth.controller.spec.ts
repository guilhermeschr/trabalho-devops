import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpErrorFilter } from '../../../../common/http-error.filter';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  User,
} from '../../domain/user';
import { AuthController } from './auth.controller';

const user: User = {
  id: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
  name: 'Maria Silva',
  email: 'maria@example.com',
  passwordHash: '$2b$10$hash-que-nunca-sai',
  createdAt: new Date('2026-09-16T15:00:00.000Z'),
};

describe('AuthController (HTTP)', () => {
  let app: INestApplication;
  const register = { execute: jest.fn() };
  const login = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUserUseCase, useValue: register },
        { provide: LoginUseCase, useValue: login },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpErrorFilter());
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  const body = {
    name: 'Maria Silva',
    email: 'Maria@Example.com',
    password: 'SenhaSegura123',
  };

  it('cadastra usuário e retorna 201 sem senha nem hash', async () => {
    register.execute.mockResolvedValue(user);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(body)
      .expect(201);

    expect(response.body).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: '2026-09-16T15:00:00.000Z',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|hash/iu);
    expect(register.execute).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'maria@example.com' }),
    );
  });

  it('retorna 400 no formato padrão para senha inválida', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Request-Id', 'req-teste-1')
      .send({ ...body, password: 'curta' })
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 400,
        code: 'VALIDATION_ERROR',
        path: '/api/v1/auth/register',
        traceId: 'req-teste-1',
        timestamp: expect.any(String),
      }),
    );
    expect(register.execute).not.toHaveBeenCalled();
  });

  it('retorna 409 para e-mail duplicado', async () => {
    register.execute.mockRejectedValue(new EmailAlreadyRegisteredError());

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(body)
      .expect(409);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 409,
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'E-mail já cadastrado',
      }),
    );
  });

  it('autentica e retorna 200 com o token', async () => {
    login.execute.mockResolvedValue({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);

    expect(response.body).toEqual({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  it('retorna 401 para credenciais inválidas', async () => {
    login.execute.mockRejectedValue(new InvalidCredentialsError());

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: 'errada123' })
      .expect(401);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciais inválidas',
      }),
    );
  });

  it('retorna 500 genérico sem expor detalhes internos', async () => {
    login.execute.mockRejectedValue(new Error('senha do banco: segredo'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(500);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain('segredo');
  });
});
