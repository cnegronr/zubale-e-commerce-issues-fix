import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;

  const mockUser = {
    id: 1,
    email: 'john@example.com',
    name: 'John Doe',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findAll: jest.fn().mockResolvedValue([mockUser]),
      findOne: jest.fn().mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockUser);
        return Promise.reject(new NotFoundException(`User #${id} not found`));
      }),
      create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto, isActive: true })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: CACHE_MANAGER,
          useValue: {},
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /users - should return an array of users', () => {
    return request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].email).toBe('john@example.com');
      });
  });

  it('GET /users/1 - should return a single user by id', () => {
    return request(app.getHttpServer())
      .get('/users/1')
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(1);
        expect(res.body.name).toBe('John Doe');
      });
  });

  it('GET /users/99 - should return 404 if user not found', () => {
    return request(app.getHttpServer())
      .get('/users/99')
      .expect(404);
  });

  it('POST /users - should create a new user with valid DTO', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'new@example.com', name: 'New User' })
      .expect(201)
      .expect((res) => {
        expect(res.body.email).toBe('new@example.com');
      });
  });

  it('POST /users - should return 400 when invalid email DTO is sent', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'not-an-email', name: 'New User' })
      .expect(400);
  });

  it('DELETE /users/1 - should remove a user by id', () => {
    return request(app.getHttpServer())
      .delete('/users/1')
      .expect(200);
  });
});
