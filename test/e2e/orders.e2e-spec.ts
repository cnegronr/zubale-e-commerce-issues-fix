import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { OrdersController } from '../../src/orders/orders.controller';
import { OrdersService } from '../../src/orders/orders.service';
import { Order, OrderStatus } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { UsersService } from '../../src/users/users.service';
import { ProductsService } from '../../src/products/products.service';

describe('OrdersController (e2e)', () => {
  let app: INestApplication<App>;
  let ordersService: jest.Mocked<OrdersService>;

  const mockOrder = {
    id: 1,
    userId: 1,
    status: OrderStatus.PENDING,
    total: 100,
    createdAt: new Date().toISOString(),
    items: [],
  };

  beforeEach(async () => {
    const mockOrdersService = {
      findAll: jest.fn().mockResolvedValue([mockOrder]),
      findByUser: jest.fn().mockResolvedValue([mockOrder]),
      findOne: jest.fn().mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockOrder);
        return Promise.reject(new NotFoundException(`Order #${id} not found`));
      }),
      getOrderWithFullDetails: jest.fn().mockResolvedValue({ ...mockOrder, enriched: true }),
      create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto, status: OrderStatus.PENDING, total: 100 })),
      processPayment: jest.fn().mockResolvedValue({ success: true, transactionId: 'TXN-123' }),
      updateStatus: jest.fn().mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED }),
      cancel: jest.fn().mockResolvedValue({ ...mockOrder, status: OrderStatus.CANCELLED }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {},
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: ProductsService,
          useValue: {},
        },
        {
          provide: CACHE_MANAGER,
          useValue: {},
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    ordersService = moduleFixture.get(OrdersService);
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
      .expect(200)
      .expect((res) => {
        expect(ordersService.findByUser).toHaveBeenCalledWith(1);
      });
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

  it('GET /orders/1/full - should return order with full details', () => {
    return request(app.getHttpServer())
      .get('/orders/1/full')
      .expect(200)
      .expect((res) => {
        expect(res.body.enriched).toBe(true);
      });
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

  it('POST /orders/1/pay - should process payment for order', () => {
    return request(app.getHttpServer())
      .post('/orders/1/pay')
      .expect(201)
      .expect((res) => {
        expect(res.body.transactionId).toBe('TXN-123');
      });
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

  it('POST /orders/1/cancel - should cancel order', () => {
    return request(app.getHttpServer())
      .post('/orders/1/cancel')
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(OrderStatus.CANCELLED);
      });
  });
});
