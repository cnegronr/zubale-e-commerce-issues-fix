import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { OrdersController } from '../../src/orders/orders.controller';
import { OrdersService } from '../../src/orders/orders.service';
import { Order, OrderStatus } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { User } from '../../src/users/user.entity';
import { Product } from '../../src/products/product.entity';
import { Category } from '../../src/products/category.entity';
import { UsersService } from '../../src/users/users.service';
import { ProductsService } from '../../src/products/products.service';

describe('OrdersController (e2e)', () => {
  let app: INestApplication<App>;
  let ordersService: OrdersService;
  let productsService: ProductsService;

  const mockUser = { id: 1, name: 'User 1', email: 'user1@example.com', isActive: true, createdAt: new Date() };
  const mockProduct = { id: 1, name: 'Product 1', stock: 10, price: 50, isAvailable: true, categoryId: 1 };

  const mockOrder: any = {
    id: 1,
    userId: 1,
    status: OrderStatus.PENDING,
    total: 100,
    createdAt: new Date(),
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
    let currentStatus = OrderStatus.PENDING;

    const mockOrdersRepo = {
      find: jest.fn().mockResolvedValue([mockOrder]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where && where.id === 1) {
          return Promise.resolve({ ...mockOrder, status: currentStatus });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn((dto) => ({ ...dto, id: 1 })),
      save: jest.fn((o) => {
        currentStatus = o.status;
        return Promise.resolve({ ...o, id: 1 });
      }),
    };

    const mockOrderItemsRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((i) => Promise.resolve(i)),
    };

    const mockUsersRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
    };

    const mockProductsRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve(mockProduct);
        return Promise.resolve(null);
      }),
      save: jest.fn((p) => Promise.resolve(p)),
    };

    const mockCategoriesRepo = {
      findOne: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        OrdersService,
        UsersService,
        ProductsService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrdersRepo,
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockOrderItemsRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepo,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductsRepo,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoriesRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    ordersService = moduleFixture.get(OrdersService);
    productsService = moduleFixture.get(ProductsService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /orders - should return all orders', () => {
    return request(app.getHttpServer())
      .get('/orders')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].id).toBe(1);
      });
  });

  it('GET /orders?userId=1 - should return orders by userId', () => {
    return request(app.getHttpServer())
      .get('/orders?userId=1')
      .expect(200);
  });

  it('GET /orders/1 - should return order by id', () => {
    return request(app.getHttpServer())
      .get('/orders/1')
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(1);
      });
  });

  it('GET /orders/99 - should return 404 if order not found', () => {
    return request(app.getHttpServer())
      .get('/orders/99')
      .expect(404);
  });

  it('GET /orders/1/full - should return order with full details without circular references', () => {
    return request(app.getHttpServer())
      .get('/orders/1/full')
      .expect(200)
      .expect((res) => {
        expect(res.body.user).toBeDefined();
        expect(res.body.user.latestOrder).toBeUndefined();
      });
  });

  it('GET /orders/99/full - should return 404 when full details order not found', () => {
    return request(app.getHttpServer())
      .get('/orders/99/full')
      .expect(404);
  });

  it('POST /orders - should create an order with valid DTO', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 1, items: [{ productId: 1, quantity: 2 }] })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe(1);
      });
  });

  it('POST /orders - should return 400 when userId is invalid', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 99, items: [{ productId: 1, quantity: 1 }] })
      .expect(400);
  });

  it('POST /orders - should return 400 when productId does not exist', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 1, items: [{ productId: 99, quantity: 1 }] })
      .expect(400);
  });

  it('POST /orders - should return 400 when product stock is insufficient', async () => {
    jest.spyOn(productsService, 'findOne').mockResolvedValueOnce({ ...mockProduct, stock: 1 } as any);
    await request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 1, items: [{ productId: 1, quantity: 5 }] })
      .expect(400);
  });

  it('POST /orders - should return 400 when items is empty array []', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 1, items: [] })
      .expect(400);
  });

  it('POST /orders/1/pay - should process payment for order when random payment succeeds', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    return request(app.getHttpServer())
      .post('/orders/1/pay')
      .expect(201);
  });

  it('POST /orders/1/pay - should return 400 when order is cancelled', async () => {
    jest.spyOn(ordersService, 'findOne').mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.CANCELLED });
    await request(app.getHttpServer())
      .post('/orders/1/pay')
      .expect(400);
  });

  it('POST /orders/1/pay - should throw 503 Service Unavailable when payment retries exhaust', async () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.05);
    await request(app.getHttpServer())
      .post('/orders/1/pay')
      .expect(503);
    spy.mockRestore();
  });

  it('PATCH /orders/1/status - should update status', () => {
    return request(app.getHttpServer())
      .patch('/orders/1/status')
      .send({ status: OrderStatus.CONFIRMED })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(OrderStatus.CONFIRMED);
      });
  });

  it('POST /orders/1/cancel - should cancel pending order and return idempotently if cancelled again', async () => {
    await request(app.getHttpServer())
      .post('/orders/1/cancel')
      .expect(201);

    await request(app.getHttpServer())
      .post('/orders/1/cancel')
      .expect(201);
  });

  it('cancel validation - should throw BadRequestException if order is confirmed', async () => {
    jest.spyOn(ordersService, 'findOne').mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.CONFIRMED });
    await expect(ordersService.cancel(1)).rejects.toThrow(BadRequestException);
  });
});
