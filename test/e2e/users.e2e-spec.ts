import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: any;
  let cacheManager: any;

  const mockUser = {
    id: 1,
    email: 'john@example.com',
    name: 'John Doe',
    isActive: true,
    createdAt: new Date(),
    orders: [],
  };

  beforeEach(async () => {
    const mockUsersRepo = {
      find: jest.fn().mockResolvedValue([mockUser]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
      create: jest.fn((dto) => dto),
      save: jest.fn((u) => {
        if (u.email === 'duplicate@example.com') {
          const err: any = new Error('duplicate key');
          err.code = '23505';
          return Promise.reject(err);
        }
        if (u.email === 'error@example.com') {
          return Promise.reject(new Error('Unknown DB Error'));
        }
        return Promise.resolve({ ...u, id: 1, isActive: true, createdAt: new Date() });
      }),
      remove: jest.fn().mockResolvedValue(mockUser),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    usersRepository = moduleFixture.get(getRepositoryToken(User));
    cacheManager = moduleFixture.get(CACHE_MANAGER);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /users - should return cached users when available', async () => {
    cacheManager.get.mockResolvedValueOnce([mockUser]);
    await request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect((res) => {
        expect(res.body[0].email).toBe('john@example.com');
      });
  });

  it('GET /users - should fetch users from repository when not cached', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('GET /users/1 - should return user by id (cached and uncached)', async () => {
    cacheManager.get.mockResolvedValueOnce(mockUser);
    await request(app.getHttpServer())
      .get('/users/1')
      .expect(200);

    cacheManager.get.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get('/users/1')
      .expect(200);
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

  it('POST /users - should return 409 Conflict when duplicate email is registered', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'duplicate@example.com', name: 'Duplicate User' })
      .expect(409);
  });

  it('POST /users - should throw 500 when unknown DB error occurs', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'error@example.com', name: 'Err User' })
      .expect(500);
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
