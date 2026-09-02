import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../src/orders/orders.service';
import { OrdersController } from '../../src/orders/orders.controller';
import { Order, OrderStatus } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { UsersService } from '../../src/users/users.service';
import { ProductsService } from '../../src/products/products.service';

describe('Orders Contract & Integration Tests', () => {
  let ordersService: OrdersService;
  let ordersController: OrdersController;
  let productsService: jest.Mocked<ProductsService>;
  let usersService: jest.Mocked<UsersService>;
  let ordersRepository: any;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: 50,
    stock: 10,
    description: 'Desc',
    isAvailable: true,
    categoryId: 1,
  };

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
  };

  const mockOrder = {
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
      find: jest.fn().mockResolvedValue([mockOrder]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where && where.id === 1)
          return Promise.resolve({ ...mockOrder, status: OrderStatus.PENDING });
        return Promise.resolve(null);
      }),
      create: jest.fn((dto) => ({ ...dto, id: 1 })),
      save: jest.fn((order) => Promise.resolve(order)),
    };

    const mockOrderItemsRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((item) => Promise.resolve(item)),
    };

    const mockUsersService = {
      findOne: jest.fn().mockImplementation(async (id: number) => {
        if (id === 1) return mockUser;
        throw new NotFoundException(`User #${id} not found`);
      }),
    };

    const mockProductsService = {
      findOne: jest.fn().mockImplementation(async (id: number) => {
        if (id === 1) return mockProduct;
        throw new NotFoundException(`Product #${id} not found`);
      }),
      updateStock: jest.fn().mockResolvedValue({ ...mockProduct, stock: 8 }),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
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

    ordersService = module.get<OrdersService>(OrdersService);
    ordersController = module.get<OrdersController>(OrdersController);
    productsService = module.get(ProductsService);
    usersService = module.get(UsersService);
    ordersRepository = module.get(getRepositoryToken(Order));
  });

  describe('API Contract: JSON Serialization Guarantee (getOrderWithFullDetails)', () => {
    it('MUST return a clean JSON serializable response without circular reference errors', async () => {
      const response: any = await ordersService.getOrderWithFullDetails(1);

      expect(() => JSON.stringify(response)).not.toThrow();
      expect(response.user.latestOrder).toBeDefined();
      expect(response.user.latestOrder.id).toEqual(1);
    });

    it('throws BadRequestException for non-positive order id', async () => {
      await expect(ordersService.getOrderWithFullDetails(0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when order full details is not found', async () => {
      await expect(ordersService.getOrderWithFullDetails(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('API Contract: Async Stock Deduction Await Guarantee (create)', () => {
    it('MUST await stock updates before returning the created order', async () => {
      let stockUpdateCompleted = false;

      productsService.updateStock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        stockUpdateCompleted = true;
        return { ...mockProduct, stock: 8 } as any;
      });

      const dto = {
        userId: 1,
        items: [{ productId: 1, quantity: 2 }],
      };

      await ordersService.create(dto);

      expect(stockUpdateCompleted).toBe(true);
    });

    it('throws BadRequestException when order creation has invalid user', async () => {
      await expect(
        ordersService.create({
          userId: 99,
          items: [{ productId: 1, quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when order creation has non-existing product IDs', async () => {
      await expect(
        ordersService.create({
          userId: 1,
          items: [{ productId: 99, quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when order creation has insufficient stock', async () => {
      productsService.findOne.mockResolvedValueOnce({
        ...mockProduct,
        stock: 1,
      } as any);
      await expect(
        ordersService.create({
          userId: 1,
          items: [{ productId: 1, quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when order creation has empty items', async () => {
      await expect(
        ordersService.create({ userId: 1, items: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('OrdersController Integration', () => {
    it('findAll with and without userId query param', async () => {
      expect(await ordersController.findAll()).toEqual([mockOrder]);
      expect(await ordersController.findAll('1')).toEqual([mockOrder]);
      expect(await ordersService.findByUser(1)).toEqual([mockOrder]);
    });

    it('findOne and getFullDetails endpoints', async () => {
      expect(await ordersController.findOne(1)).toEqual(mockOrder);
      expect(await ordersController.getFullDetails(1)).toBeDefined();
      await expect(ordersService.findOne(99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('create, updateStatus, processPayment, cancel endpoints', async () => {
      expect(
        await ordersController.create({
          userId: 1,
          items: [{ productId: 1, quantity: 2 }],
        }),
      ).toBeDefined();

      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      ordersRepository.findOne.mockResolvedValue(confirmedOrder);
      expect(
        await ordersController.updateStatus(1, OrderStatus.SHIPPED),
      ).toBeDefined();

      const shippedOrder = { ...mockOrder, status: OrderStatus.SHIPPED };
      ordersRepository.findOne.mockResolvedValue(shippedOrder);
      expect(
        await ordersController.updateStatus(1, OrderStatus.DELIVERED),
      ).toBeDefined();

      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      ordersRepository.findOne.mockResolvedValue(pendingOrder);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(await ordersController.processPayment(1)).toBeDefined();

      const pendingOrderForCancel = {
        ...mockOrder,
        status: OrderStatus.PENDING,
      };
      ordersRepository.findOne.mockResolvedValueOnce(pendingOrderForCancel);
      expect(await ordersController.cancel(1)).toBeDefined();

      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      ordersRepository.findOne.mockResolvedValueOnce(cancelledOrder);
      expect(await ordersService.cancel(1)).toEqual(cancelledOrder);

      const confirmedOrderForCancel = {
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      };
      ordersRepository.findOne.mockResolvedValueOnce(confirmedOrderForCancel);
      await expect(ordersService.cancel(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
