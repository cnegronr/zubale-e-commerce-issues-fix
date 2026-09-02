import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../../src/users/users.controller';
import { UsersService } from '../../../src/users/users.service';
import { CreateUserDto } from '../../../src/users/dto/create-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      service.findAll.mockResolvedValue([mockUser as any]);
      const result = await controller.findAll();
      expect(result).toEqual([mockUser]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single user by id', async () => {
      service.findOne.mockResolvedValue(mockUser as any);
      const result = await controller.findOne(1);
      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      const dto: CreateUserDto = {
        email: 'test@example.com',
        name: 'Test User',
      };
      service.create.mockResolvedValue(mockUser as any);
      const result = await controller.create(dto);
      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('remove', () => {
    it('should remove a user by id', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove(1);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
