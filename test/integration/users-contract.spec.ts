import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../../src/users/users.service';
import { UsersController } from '../../src/users/users.controller';
import { User } from '../../src/users/user.entity';

describe('Users Contract & Integration Tests', () => {
  let usersService: UsersService;
  let usersController: UsersController;
  let usersRepository: any;
  let cacheManager: any;

  const mockUser: any = {
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
      save: jest.fn((u) => Promise.resolve({ ...u, id: 1 })),
      remove: jest.fn().mockResolvedValue(mockUser),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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

    usersService = module.get<UsersService>(UsersService);
    usersController = module.get<UsersController>(UsersController);
    usersRepository = module.get(getRepositoryToken(User));
    cacheManager = module.get(CACHE_MANAGER);
  });

  describe('Domain Exception Contract: Duplicate Email Handling', () => {
    it('MUST throw BadRequestException (400 Bad Request) when fetching user with id 0 or negative', async () => {
      await expect(usersController.findOne(0)).rejects.toThrow(BadRequestException);
      await expect(usersController.findOne(-5)).rejects.toThrow(BadRequestException);
    });

    it('MUST throw a clean domain exception (ConflictException) when registering a duplicate email', async () => {
      const dbError: any = new Error('duplicate key value violates unique constraint "UQ_97672ac88f789774dd47f7c8be3"');
      dbError.code = '23505';

      usersRepository.save.mockRejectedValueOnce(dbError);

      const dto = { email: 'existing@example.com', name: 'Existing User' };

      await expect(usersService.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-duplicate errors during user creation', async () => {
      usersRepository.save.mockRejectedValueOnce(new Error('DB failure'));
      await expect(usersService.create({ email: 'err@example.com', name: 'Err' })).rejects.toThrow('DB failure');
    });
  });

  describe('Full Users Service Integration & Caching', () => {
    it('findAll returns cached or DB users', async () => {
      cacheManager.get.mockResolvedValueOnce([mockUser]);
      expect(await usersService.findAll()).toEqual([mockUser]);

      cacheManager.get.mockResolvedValueOnce(null);
      expect(await usersService.findAll()).toEqual([mockUser]);
    });

    it('findOne returns cached user, DB user, or throws NotFoundException', async () => {
      cacheManager.get.mockResolvedValueOnce(mockUser);
      expect(await usersService.findOne(1)).toEqual(mockUser);

      cacheManager.get.mockResolvedValueOnce(null);
      expect(await usersService.findOne(1)).toEqual(mockUser);

      cacheManager.get.mockResolvedValueOnce(null);
      await expect(usersService.findOne(99)).rejects.toThrow(NotFoundException);
    });

    it('remove invalidates cache keys', async () => {
      await usersService.remove(1);
      expect(usersRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('UsersController integration endpoints', async () => {
      expect(await usersController.findAll()).toEqual([mockUser]);
      expect(await usersController.findOne(1)).toEqual(mockUser);
      expect(await usersController.create({ email: 'new@example.com', name: 'New' })).toBeDefined();
      await usersController.remove(1);
    });
  });
});
