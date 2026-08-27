import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../../../src/users/users.service';
import { User } from '../../../src/users/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repository: any;
  let cacheManager: any;

  const mockUser: any = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    createdAt: new Date(),
    orders: [],
  };

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
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
          useValue: mockRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return cached users if available', async () => {
      cacheManager.get.mockResolvedValue([mockUser]);
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(cacheManager.get).toHaveBeenCalledWith('users:all');
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('should fetch users from DB and cache them if not cached', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(repository.find).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith('users:all', [mockUser], 60000);
    });
  });

  describe('findOne', () => {
    it('should return cached user if available', async () => {
      cacheManager.get.mockResolvedValue(mockUser);
      const result = await service.findOne(1);
      expect(result).toEqual(mockUser);
      expect(cacheManager.get).toHaveBeenCalledWith('user:1');
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch user from DB and cache it if not in cache', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(1);
      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(cacheManager.set).toHaveBeenCalledWith('user:1', mockUser, 60000);
    });

    it('should throw NotFoundException if user is not found in DB', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create user, save, clear cache and return saved user', async () => {
      const dto = { email: 'new@example.com', name: 'New User' };
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      const result = await service.create(dto);
      expect(result).toEqual(mockUser);
      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(mockUser);
      expect(cacheManager.del).toHaveBeenCalledWith('users:all');
    });
  });

  describe('remove', () => {
    it('should remove user and invalidate cache keys', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockUser);
      repository.remove.mockResolvedValue(mockUser);

      await service.remove(1);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(repository.remove).toHaveBeenCalledWith(mockUser);
      expect(cacheManager.del).toHaveBeenCalledWith('users:all');
      expect(cacheManager.del).toHaveBeenCalledWith('user:1');
    });
  });
});
