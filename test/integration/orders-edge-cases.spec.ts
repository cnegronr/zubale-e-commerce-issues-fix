import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../src/orders/orders.service';
import { Order, OrderStatus } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { UsersService } from '../../src/users/users.service';
import { ProductsService } from '../../src/products/products.service';

describe('Orders Edge-Case & Idempotency Tests', () => {
  let ordersService: OrdersService;
  let productsService: jest.Mocked<ProductsService>;
  let usersService: jest.Mocked<UsersService>;
  let stockRestoredCount = 0;

  const mockOrder: any = {
    id: 1,
    userId: 1,
    status: OrderStatus.PENDING,
    total: 100,
    items: [
      { productId: 1, quantity: 5 },
    ],
  };

  beforeEach(async () => {
    stockRestoredCount = 0;

    let currentStatus = OrderStatus.PENDING;

    const mockOrdersRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where && where.id === 999) {
          return null;
        }
        return { ...mockOrder, status: currentStatus };
      }),
      create: jest.fn((dto) => ({ ...dto, id: 1 })),
      save: jest.fn((o) => {
        currentStatus = o.status;
        return Promise.resolve({ ...o });
      }),
    };

    const mockOrderItemsRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((i) => Promise.resolve(i)),
    };

    const mockUsersService = {
      findOne: jest.fn().mockResolvedValue({ id: 1, name: 'User 1' }),
    };

    const mockProductsService = {
      findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Product 1', stock: 10 }),
      updateStock: jest.fn(async (id: number, newStock: number) => {
        stockRestoredCount += 5;
        return { id: 1, name: 'Product 1', stock: newStock } as any;
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
  });

  describe('Payload Contract: Empty Items Order Validation (create)', () => {
    it('MUST throw BadRequestException when create order payload has empty items []', async () => {
      const dto = { userId: 1, items: [] };

      await expect(ordersService.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Payment Processing Contract: Non-Pending Order Payment Rejection', () => {
    it('MUST throw BadRequestException when attempting to process payment for a cancelled order', async () => {
      await ordersService.cancel(1);
      await expect(ordersService.processPayment(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Idempotency Contract: Concurrent Cancellation Stock Protection (cancel)', () => {
    it('MUST be idempotent and restore product stock exactly ONCE under concurrent cancellation requests', async () => {
      // Trigger sequential/concurrent cancellation requests for the same order
      await ordersService.cancel(1);
      await ordersService.cancel(1);

      // Idempotency assertion: Stock MUST only be restored once (5 units), NOT twice (10 units)
      expect(stockRestoredCount).toBe(5);
    });
  });

  describe('Order Status Update Contract: State Machine and Validation Rules (updateStatus)', () => {
    it('MUST throw BadRequestException (400 Bad Request) when orderId does not exist', async () => {
      await expect(ordersService.updateStatus(999, OrderStatus.SHIPPED)).rejects.toThrow(BadRequestException);
    });

    it('MUST throw BadRequestException (400 Bad Request) when target status is invalid', async () => {
      await expect(ordersService.updateStatus(1, OrderStatus.CANCELLED)).rejects.toThrow(BadRequestException);
      await expect(ordersService.updateStatus(1, 'INVALID' as any)).rejects.toThrow(BadRequestException);
    });

    it('MUST throw BadRequestException when attempting to update pending, cancelled or delivered orders', async () => {
      await expect(ordersService.updateStatus(1, OrderStatus.SHIPPED)).rejects.toThrow(BadRequestException);
    });

    it('MUST throw BadRequestException when attempting to update directly to delivered when order is not shipped', async () => {
      await expect(ordersService.updateStatus(1, OrderStatus.DELIVERED)).rejects.toThrow(BadRequestException);
    });
  });
});
