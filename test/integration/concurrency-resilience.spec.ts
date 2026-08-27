import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../src/orders/orders.service';
import { Order, OrderStatus } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { UsersService } from '../../src/users/users.service';
import { ProductsService } from '../../src/products/products.service';

describe('Concurrency & System Resiliency Tests', () => {
  let ordersService: OrdersService;
  let productsService: ProductsService;
  let currentStock = 1;

  const mockUser = { id: 1, name: 'User 1' };
  const mockOrder = { id: 1, userId: 1, status: OrderStatus.PENDING, total: 50, items: [] };

  beforeEach(async () => {
    currentStock = 1;

    const mockOrdersRepo = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(mockOrder),
      create: jest.fn((dto) => ({ ...dto, id: Math.floor(Math.random() * 1000) })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const mockOrderItemsRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const mockUsersService = {
      findOne: jest.fn().mockResolvedValue(mockUser),
    };

    const mockProductsService = {
      findOne: jest.fn(async () => ({
        id: 1,
        name: 'Limited Stock Item',
        stock: currentStock,
        price: 50,
      })),
      updateStock: jest.fn(async (id: number, newStock: number) => {
        // Simulates async DB write delay where race condition manifests
        await new Promise((resolve) => setTimeout(resolve, 30));
        currentStock = newStock;
        return { id: 1, name: 'Limited Stock Item', stock: currentStock, price: 50 } as any;
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
    productsService = module.get<ProductsService>(ProductsService);
  });

  describe('Resiliency: Concurrency & Stock Overdraft Prevention', () => {
    it('MUST prevent stock overdraft under simultaneous order requests (Promise.all)', async () => {
      const orderDto1 = { userId: 1, items: [{ productId: 1, quantity: 1 }] };
      const orderDto2 = { userId: 1, items: [{ productId: 1, quantity: 1 }] };

      // Execute two order requests concurrently when stock is 1
      const results = await Promise.allSettled([
        ordersService.create(orderDto1),
        ordersService.create(orderDto2),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Resiliency assertion: Exactly 1 order MUST succeed and 1 MUST fail due to insufficient stock
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(currentStock).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resiliency: Payment Retry Bounded Execution Limits', () => {
    it('MUST cap payment retry attempts to a maximum of 5 attempts to prevent blocking HTTP sockets', async () => {
      let attemptsCounter = 0;
      jest.spyOn(Math, 'random').mockImplementation(() => {
        attemptsCounter++;
        return 0.05; // Payment always fails
      });

      const startTime = Date.now();
      const paymentPromise = ordersService.processPayment(1);

      await expect(paymentPromise).rejects.toThrow();
      const elapsedTime = Date.now() - startTime;

      // Resiliency assertion: Retry attempts MUST NOT exceed 5 attempts, and execution time MUST be under 1500ms
      expect(attemptsCounter).toBeLessThanOrEqual(5);
      expect(elapsedTime).toBeLessThan(1500);
    });
  });
});
