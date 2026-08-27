import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from '../../../src/orders/orders.controller';
import { OrdersService } from '../../../src/orders/orders.service';
import { CreateOrderDto } from '../../../src/orders/dto/create-order.dto';
import { OrderStatus } from '../../../src/orders/order.entity';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  const mockOrder = {
    id: 1,
    userId: 1,
    status: OrderStatus.PENDING,
    total: 100,
    createdAt: new Date(),
    items: [],
  };

  beforeEach(async () => {
    const mockOrdersService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByUser: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      processPayment: jest.fn(),
      cancel: jest.fn(),
      getOrderWithFullDetails: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all orders when no userId query param is provided', async () => {
      service.findAll.mockResolvedValue([mockOrder as any]);
      expect(await controller.findAll()).toEqual([mockOrder]);
      expect(service.findAll).toHaveBeenCalled();
      expect(service.findByUser).not.toHaveBeenCalled();
    });

    it('should return orders by user when userId query param is provided', async () => {
      service.findByUser.mockResolvedValue([mockOrder as any]);
      expect(await controller.findAll('1')).toEqual([mockOrder]);
      expect(service.findByUser).toHaveBeenCalledWith(1);
      expect(service.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return order by id', async () => {
      service.findOne.mockResolvedValue(mockOrder as any);
      expect(await controller.findOne(1)).toEqual(mockOrder);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('getFullDetails', () => {
    it('should return order with full details', async () => {
      service.getOrderWithFullDetails.mockResolvedValue({ ...mockOrder, enriched: true });
      expect(await controller.getFullDetails(1)).toEqual({ ...mockOrder, enriched: true });
      expect(service.getOrderWithFullDetails).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should create order', async () => {
      const dto: CreateOrderDto = { userId: 1, items: [{ productId: 1, quantity: 2 }] };
      service.create.mockResolvedValue(mockOrder as any);
      expect(await controller.create(dto)).toEqual(mockOrder);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('processPayment', () => {
    it('should process payment for order', async () => {
      const paymentResult = { success: true, transactionId: 'TXN-123' };
      service.processPayment.mockResolvedValue(paymentResult);
      expect(await controller.processPayment(1)).toEqual(paymentResult);
      expect(service.processPayment).toHaveBeenCalledWith(1);
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      service.updateStatus.mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED } as any);
      expect(await controller.updateStatus(1, OrderStatus.CONFIRMED)).toEqual({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      });
      expect(service.updateStatus).toHaveBeenCalledWith(1, OrderStatus.CONFIRMED);
    });
  });

  describe('cancel', () => {
    it('should cancel order', async () => {
      service.cancel.mockResolvedValue({ ...mockOrder, status: OrderStatus.CANCELLED } as any);
      expect(await controller.cancel(1)).toEqual({ ...mockOrder, status: OrderStatus.CANCELLED });
      expect(service.cancel).toHaveBeenCalledWith(1);
    });
  });
});
