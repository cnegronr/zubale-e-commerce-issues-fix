import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../../src/orders/orders.service';
import { Order, OrderStatus } from '../../../src/orders/order.entity';
import { OrderItem } from '../../../src/orders/order-item.entity';
import { UsersService } from '../../../src/users/users.service';
import { ProductsService } from '../../../src/products/products.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepository: any;
  let orderItemsRepository: any;
  let usersService: jest.Mocked<UsersService>;
  let productsService: jest.Mocked<ProductsService>;
  let cacheManager: any;

  const mockOrder: any = {
    id: 1,
    userId: 1,
    status: OrderStatus.PENDING,
    total: 100,
    createdAt: new Date(),
    user: { id: 1, name: 'User 1' },
    items: [
      {
        id: 1,
        orderId: 1,
        productId: 1,
        quantity: 2,
        price: 50,
        product: { id: 1, name: 'Product 1', stock: 10 },
      },
    ],
  };

  const mockProduct: any = {
    id: 1,
    name: 'Product 1',
    stock: 10,
    price: 50,
  };

  const mockUser: any = {
    id: 1,
    name: 'User 1',
  };

  beforeEach(async () => {
    const mockOrdersRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockOrderItemsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockUsersService = {
      findOne: jest.fn(),
    };

    const mockProductsService = {
      findOne: jest.fn(),
      updateStock: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrdersRepo,
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockOrderItemsRepo,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    ordersRepository = module.get(getRepositoryToken(Order));
    orderItemsRepository = module.get(getRepositoryToken(OrderItem));
    usersService = module.get(UsersService);
    productsService = module.get(ProductsService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all orders with relations', async () => {
      ordersRepository.find.mockResolvedValue([mockOrder]);
      const result = await service.findAll();
      expect(result).toEqual([mockOrder]);
      expect(ordersRepository.find).toHaveBeenCalledWith({
        relations: ['user', 'items', 'items.product'],
      });
    });
  });

  describe('findOne', () => {
    it('should return an order if found', async () => {
      ordersRepository.findOne.mockResolvedValue(mockOrder);
      const result = await service.findOne(1);
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      ordersRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUser', () => {
    it('should return orders by userId', async () => {
      ordersRepository.find.mockResolvedValue([mockOrder]);
      const result = await service.findByUser(1);
      expect(result).toEqual([mockOrder]);
      expect(ordersRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        relations: ['items', 'items.product'],
      });
    });
  });

  describe('create', () => {
    it('should create order successfully when stock is available', async () => {
      usersService.findOne.mockResolvedValue(mockUser);
      ordersRepository.create.mockReturnValue({ userId: 1, status: OrderStatus.PENDING });
      ordersRepository.save.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.PENDING });
      productsService.findOne.mockResolvedValue(mockProduct);
      orderItemsRepository.create.mockReturnValue({ orderId: 1, productId: 1, quantity: 2, price: 50 });
      orderItemsRepository.save.mockResolvedValue({});
      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder);

      const dto = { userId: 1, items: [{ productId: 1, quantity: 2 }] };
      const result = await service.create(dto);
      expect(result).toEqual(mockOrder);
      expect(productsService.updateStock).toHaveBeenCalledWith(1, 8);
    });

    it('should throw BadRequestException if order items is empty', async () => {
      const dto = { userId: 1, items: [] };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if product stock is insufficient', async () => {
      usersService.findOne.mockResolvedValue(mockUser);
      ordersRepository.create.mockReturnValue({ userId: 1, status: OrderStatus.PENDING });
      ordersRepository.save.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.PENDING });
      productsService.findOne.mockResolvedValue({ ...mockProduct, stock: 1 });

      const dto = { userId: 1, items: [{ productId: 1, quantity: 2 }] };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should update status and save order', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder });
      ordersRepository.save.mockImplementation(async (o: any) => o);

      const result = await service.updateStatus(1, OrderStatus.CONFIRMED);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });
  });

  describe('processPayment', () => {
    it('should confirm order and return result when payment succeeds', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder });
      ordersRepository.save.mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED });
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Payment succeeds

      const result = await service.processPayment(1);
      expect(result.success).toBe(true);
      expect(ordersRepository.save).toHaveBeenCalled();
    });

    it('should retry payment when payment service throws an error and throw lastError after maxRetries', async () => {
      (service as any).maxRetries = 2;
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder });
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // Payment fails

      await expect(service.processPayment(1)).rejects.toThrow('Payment service unavailable');
    });
  });

  describe('cancel', () => {
    it('should cancel pending order and restore product stock', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.PENDING });
      productsService.findOne.mockResolvedValue(mockProduct);
      ordersRepository.save.mockImplementation(async (o: any) => o);

      const result = await service.cancel(1);
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(productsService.updateStock).toHaveBeenCalledWith(1, 12);
    });

    it('should return already cancelled order idempotently without restoring stock again', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.CANCELLED });
      const result = await service.cancel(1);
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(productsService.updateStock).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if order is not pending or cancelled (e.g. confirmed)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED });
      await expect(service.cancel(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrderWithFullDetails', () => {
    it('should throw NotFoundException if order is not found', async () => {
      ordersRepository.findOne.mockResolvedValue(null);
      await expect(service.getOrderWithFullDetails(99)).rejects.toThrow(NotFoundException);
    });

    it('should return clean enriched JSON without circular references', async () => {
      ordersRepository.findOne.mockResolvedValue({
        id: 1,
        user: { id: 1, name: 'User', email: 'user@example.com', isActive: true, createdAt: new Date() },
        items: [],
      });

      const result = await service.getOrderWithFullDetails(1);
      expect(result.id).toBe(1);
      expect(result.user.name).toBe('User');
      expect(result.user.latestOrder).toBeUndefined();
    });
  });
});
