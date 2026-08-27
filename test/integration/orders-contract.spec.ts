import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../src/orders/orders.service';
import { Order, OrderStatus } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { UsersService } from '../../src/users/users.service';
import { ProductsService } from '../../src/products/products.service';

describe('Orders Contract & Resiliency Tests', () => {
  let ordersService: OrdersService;
  let ordersRepository: any;
  let orderItemsRepository: any;
  let usersService: jest.Mocked<UsersService>;
  let productsService: jest.Mocked<ProductsService>;

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

    ordersService = module.get<OrdersService>(OrdersService);
    ordersRepository = module.get(getRepositoryToken(Order));
    orderItemsRepository = module.get(getRepositoryToken(OrderItem));
    usersService = module.get(UsersService);
    productsService = module.get(ProductsService);
  });

  describe('API Contract: JSON Serialization Guarantee (getOrderWithFullDetails)', () => {
    it('MUST return a clean JSON serializable response without circular reference errors', async () => {
      ordersRepository.findOne.mockResolvedValue({
        id: 1,
        status: OrderStatus.PENDING,
        total: 100,
        user: { id: 1, name: 'John Doe', email: 'john@example.com' },
        items: [],
      });

      const response = await ordersService.getOrderWithFullDetails(1);

      // Contract assertion: Response MUST be serializable without throwing TypeError: Converting circular structure to JSON
      expect(() => JSON.stringify(response)).not.toThrow();
      expect(response.user.latestOrder).toBeDefined();
    });
  });

  describe('API Contract: Async Stock Deduction Await Guarantee (create)', () => {
    it('MUST await stock updates before returning the created order', async () => {
      let stockUpdateCompleted = false;

      usersService.findOne.mockResolvedValue(mockUser);
      ordersRepository.create.mockReturnValue({ userId: 1, status: OrderStatus.PENDING });
      ordersRepository.save.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.PENDING });
      productsService.findOne.mockResolvedValue(mockProduct);
      orderItemsRepository.create.mockReturnValue({ orderId: 1, productId: 1, quantity: 2, price: 50 });
      orderItemsRepository.save.mockResolvedValue({});
      jest.spyOn(ordersService, 'findOne').mockResolvedValue(mockOrder);

      // Mock updateStock with a 50ms async delay
      productsService.updateStock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        stockUpdateCompleted = true;
        return { ...mockProduct, stock: 8 };
      });

      const dto = { userId: 1, items: [{ productId: 1, quantity: 2 }] };
      await ordersService.create(dto);

      // Contract assertion: After create() finishes, stock update MUST be completed
      expect(stockUpdateCompleted).toBe(true);
    });
  });

  describe('Domain Rule: Order Cancellation Contract (cancel)', () => {
    it('MUST prevent cancellation of orders that are already CONFIRMED', async () => {
      jest.spyOn(ordersService, 'findOne').mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED });
      await expect(ordersService.cancel(1)).rejects.toThrow(BadRequestException);
    });
  });
});
