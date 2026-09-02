import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { OrdersService } from '../../src/orders/orders.service';
import { Order, OrderStatus } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { UsersService } from '../../src/users/users.service';
import { ProductsService } from '../../src/products/products.service';

describe('Concurrency & System Resiliency Tests', () => {
  let ordersService: OrdersService;
  let productsService: ProductsService;
  let usersService: UsersService;
  let ordersRepository: any;

  let currentStock = 1;

  beforeEach(async () => {
    currentStock = 1;

    const mockOrdersRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        return {
          id: where.id || 1,
          userId: 1,
          status: OrderStatus.PENDING,
          total: 100,
          user: { id: 1, name: 'User 1' },
          items: [{ id: 1, productId: 1, quantity: 1, price: 100 }],
        };
      }),
      create: jest.fn((dto) => ({
        ...dto,
        id: Math.floor(Math.random() * 1000),
      })),
      save: jest.fn((order) => Promise.resolve(order)),
    };

    const mockOrderItemsRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((item) => Promise.resolve(item)),
    };

    const mockUsersService = {
      findOne: jest.fn().mockResolvedValue({ id: 1, name: 'User 1' }),
    };

    const mockProductsService = {
      findOne: jest.fn().mockImplementation(async () => {
        return {
          id: 1,
          name: 'Limited Stock Item',
          stock: currentStock,
          price: 100,
        };
      }),
      updateStock: jest
        .fn()
        .mockImplementation(async (id: number, newStock: number) => {
          if (newStock < 0) {
            throw new Error('Stock cannot be negative');
          }
          currentStock = newStock;
          return {
            id: 1,
            name: 'Limited Stock Item',
            stock: currentStock,
            price: 100,
          };
        }),
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

    ordersService = module.get<OrdersService>(OrdersService);
    productsService = module.get(ProductsService);
    usersService = module.get(UsersService);
    ordersRepository = module.get(getRepositoryToken(Order));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Resiliency: Payment Retry Bounded Execution Limits', () => {
    it('MUST cap payment retry attempts to a maximum of 5 attempts to prevent blocking HTTP sockets', async () => {
      let attemptsCounter = 0;
      const mathRandomSpy = jest
        .spyOn(Math, 'random')
        .mockImplementation(() => {
          attemptsCounter++;
          return 0.05; // Force payment service to fail
        });

      const startTime = Date.now();
      try {
        await ordersService.processPayment(1);
      } catch (error: any) {
        expect(error.message).toBe('Payment service unavailable');
      } finally {
        mathRandomSpy.mockRestore();
      }

      const elapsedTime = Date.now() - startTime;

      expect(attemptsCounter).toBe(5);
      expect(elapsedTime).toBeLessThan(1500);
    });
  });
});
