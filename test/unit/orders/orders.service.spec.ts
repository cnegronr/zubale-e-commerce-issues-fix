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
  let usersService: any;
  let productsService: any;
  let cacheManager: any;

  const mockUser: any = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
  };

  const mockProduct: any = {
    id: 1,
    name: 'Laptop',
    price: 50,
    stock: 10,
  };

  const mockOrder: any = {
    id: 1,
    userId: 1,
    status: OrderStatus.PENDING,
    total: 100,
    user: mockUser,
    items: [
      {
        id: 1,
        orderId: 1,
        productId: 1,
        quantity: 2,
        price: 50,
        product: mockProduct,
      },
    ],
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

    it('should aggregate duplicate productId items in request body', async () => {
      usersService.findOne.mockResolvedValue(mockUser);
      ordersRepository.create.mockReturnValue({ userId: 1, status: OrderStatus.PENDING });
      ordersRepository.save.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.PENDING });
      productsService.findOne.mockResolvedValue(mockProduct);
      orderItemsRepository.create.mockReturnValue({ orderId: 1, productId: 1, quantity: 5, price: 50 });
      orderItemsRepository.save.mockResolvedValue({});
      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder);

      const dto = { userId: 1, items: [{ productId: 1, quantity: 2 }, { productId: 1, quantity: 3 }] };
      const result = await service.create(dto);
      expect(result).toEqual(mockOrder);
      expect(productsService.updateStock).toHaveBeenCalledWith(1, 5);
    });

    it('should throw BadRequestException if userId is invalid', async () => {
      usersService.findOne.mockRejectedValue(new NotFoundException('User #99 not found'));
      const dto = { userId: 99, items: [{ productId: 1, quantity: 1 }] };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order items is empty', async () => {
      const dto = { userId: 1, items: [] };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException listing missing product IDs when products do not exist', async () => {
      usersService.findOne.mockResolvedValue(mockUser);
      productsService.findOne.mockRejectedValue(new NotFoundException('Product #6 not found'));

      const dto = { userId: 1, items: [{ productId: 6, quantity: 1 }, { productId: 7, quantity: 1 }] };
      await expect(service.create(dto)).rejects.toThrow('Products not found: #6, #7');
    });

    it('should throw BadRequestException listing products with insufficient stock', async () => {
      usersService.findOne.mockResolvedValue(mockUser);
      productsService.findOne.mockResolvedValue({ ...mockProduct, stock: 1 });

      const dto = { userId: 1, items: [{ productId: 1, quantity: 5 }] };
      await expect(service.create(dto)).rejects.toThrow('Not enough stock for: Laptop (requested: 5, available: 1)');
    });
  });

  describe('updateStatus', () => {
    it('should update status from confirmed to shipped', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      jest.spyOn(service, 'findOne').mockResolvedValue(confirmedOrder);
      ordersRepository.save.mockImplementation(async (o: any) => o);

      const result = await service.updateStatus(1, OrderStatus.SHIPPED);
      expect(result.status).toBe(OrderStatus.SHIPPED);
      expect(ordersRepository.save).toHaveBeenCalled();
    });

    it('should update status from shipped to delivered', async () => {
      const shippedOrder = { ...mockOrder, status: OrderStatus.SHIPPED };
      jest.spyOn(service, 'findOne').mockResolvedValue(shippedOrder);
      ordersRepository.save.mockImplementation(async (o: any) => o);

      const result = await service.updateStatus(1, OrderStatus.DELIVERED);
      expect(result.status).toBe(OrderStatus.DELIVERED);
      expect(ordersRepository.save).toHaveBeenCalled();
    });

    it('should return order idempotently when already in shipped or delivered status', async () => {
      const shippedOrder = { ...mockOrder, status: OrderStatus.SHIPPED };
      jest.spyOn(service, 'findOne').mockResolvedValue(shippedOrder);
      const resShipped = await service.updateStatus(1, OrderStatus.SHIPPED);
      expect(resShipped.status).toBe(OrderStatus.SHIPPED);

      const deliveredOrder = { ...mockOrder, status: OrderStatus.DELIVERED };
      jest.spyOn(service, 'findOne').mockResolvedValue(deliveredOrder);
      const resDelivered = await service.updateStatus(1, OrderStatus.DELIVERED);
      expect(resDelivered.status).toBe(OrderStatus.DELIVERED);
    });

    it('should throw BadRequestException if orderId is invalid or non-existing', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException('Order #99 not found'));
      await expect(service.updateStatus(99, OrderStatus.SHIPPED)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if target status is invalid (not shipped or delivered)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED });
      await expect(service.updateStatus(1, OrderStatus.CANCELLED)).rejects.toThrow(BadRequestException);
      await expect(service.updateStatus(1, 'INVALID' as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if updating from pending, cancelled or delivered', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.PENDING });
      await expect(service.updateStatus(1, OrderStatus.SHIPPED)).rejects.toThrow(BadRequestException);

      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.CANCELLED });
      await expect(service.updateStatus(1, OrderStatus.SHIPPED)).rejects.toThrow(BadRequestException);

      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.DELIVERED });
      await expect(service.updateStatus(1, OrderStatus.SHIPPED)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to update confirmed order directly to delivered', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED });
      await expect(service.updateStatus(1, OrderStatus.DELIVERED)).rejects.toThrow('Only shipped orders can be updated to delivered');
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully when order is pending and random succeeds', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      jest.spyOn(service, 'findOne').mockResolvedValue(pendingOrder);
      ordersRepository.save.mockImplementation(async (o: any) => o);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await service.processPayment(1);
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(ordersRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if order is not pending (e.g. cancelled or confirmed)', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      jest.spyOn(service, 'findOne').mockResolvedValue(cancelledOrder);

      await expect(service.processPayment(1)).rejects.toThrow(BadRequestException);
    });

    it('should throw exception when payment retries exhaust', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      jest.spyOn(service, 'findOne').mockResolvedValue(pendingOrder);
      jest.spyOn(Math, 'random').mockReturnValue(0.05);

      await expect(service.processPayment(1)).rejects.toThrow('Payment service unavailable');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending order and restore product stock', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      ordersRepository.findOne.mockResolvedValue(pendingOrder);
      ordersRepository.save.mockImplementation(async (o: any) => o);
      productsService.findOne.mockResolvedValue(mockProduct);

      const result = await service.cancel(1);
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(productsService.updateStock).toHaveBeenCalledWith(1, 12);
    });

    it('should return order idempotently if already cancelled without modifying stock again', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      ordersRepository.findOne.mockResolvedValue(cancelledOrder);

      const result = await service.cancel(1);
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(productsService.updateStock).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if order is not pending', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      ordersRepository.findOne.mockResolvedValue(confirmedOrder);

      await expect(service.cancel(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrderWithFullDetails', () => {
    it('should return enriched order with non-circular user object', async () => {
      const fullOrder = {
        ...mockOrder,
        user: { ...mockUser, latestOrder: { id: 1 } },
      };
      ordersRepository.findOne.mockResolvedValue(fullOrder);

      const result = await service.getOrderWithFullDetails(1);
      expect(result.user.latestOrder).toBeUndefined();
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should throw NotFoundException if full order not found', async () => {
      ordersRepository.findOne.mockResolvedValue(null);
      await expect(service.getOrderWithFullDetails(99)).rejects.toThrow(NotFoundException);
    });
  });
});
