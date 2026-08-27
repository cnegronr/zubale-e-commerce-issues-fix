import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';

describe('Users Contract & Edge-Case Tests', () => {
  let usersService: UsersService;
  let usersRepository: any;

  beforeEach(async () => {
    const mockUsersRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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

    usersService = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
  });

  describe('Domain Exception Contract: Duplicate Email Handling', () => {
    it('MUST throw a clean domain exception (ConflictException/BadRequestException) when registering a duplicate email', async () => {
      // Simulate TypeORM / Postgres duplicate key error (code 23505)
      const dbError: any = new Error('duplicate key value violates unique constraint "UQ_97672ac88f789774dd47f7c8be3"');
      dbError.code = '23505';

      usersRepository.save.mockRejectedValue(dbError);

      const dto = { email: 'existing@example.com', name: 'Existing User' };

      // Contract assertion: Service MUST catch raw DB driver errors and throw a clean NestJS HTTP exception (ConflictException/BadRequestException)
      await expect(usersService.create(dto)).rejects.toSatisfy((err: any) => {
        return err instanceof ConflictException || err instanceof BadRequestException;
      });
    });
  });
});
