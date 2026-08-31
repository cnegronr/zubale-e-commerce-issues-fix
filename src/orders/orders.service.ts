import { Injectable, NotFoundException, BadRequestException, ServiceUnavailableException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Order, OrderStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UsersService } from '../users/users.service';
import { ProductsService } from '../products/products.service';

const paymentService = {
  async processPayment(orderId: number, amount: number): Promise<{ success: boolean; transactionId: string }> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (Math.random() < 0.1) {
      throw new Error('Payment service unavailable');
    }
    
    return { success: true, transactionId: `TXN-${Date.now()}` };
  }
};

@Injectable()
export class OrdersService {
  private maxRetries = 5;

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    private usersService: UsersService,
    private productsService: ProductsService,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAll(): Promise<Order[]> {
    return this.ordersRepository.find({ 
      relations: ['user', 'items', 'items.product'],
    });
  }

  async findOne(id: number): Promise<Order> {
    if (!id || id <= 0) {
      throw new BadRequestException('Order ID must be a positive integer greater than 0');
    }
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product'],
    });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  async findByUser(userId: number): Promise<Order[]> {
    if (!userId || userId <= 0) {
      throw new BadRequestException('User ID must be a positive integer greater than 0');
    }
    return this.ordersRepository.find({
      where: { userId },
      relations: ['items', 'items.product'],
    });
  }

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    if (!createOrderDto.userId || createOrderDto.userId <= 0) {
      throw new BadRequestException(`User #${createOrderDto.userId} not found`);
    }

    let user: any;
    try {
      user = await this.usersService.findOne(createOrderDto.userId);
    } catch (err) {
      throw new BadRequestException(`User #${createOrderDto.userId} not found`);
    }

    const itemMap = new Map<number, number>();
    for (const itemDto of createOrderDto.items) {
      const currentQty = itemMap.get(itemDto.productId) || 0;
      itemMap.set(itemDto.productId, currentQty + itemDto.quantity);
    }

    const missingProductIds: number[] = [];
    const insufficientStockItems: string[] = [];
    const validatedItems: Array<{ product: any; quantity: number }> = [];

    for (const [productId, totalQuantity] of itemMap.entries()) {
      if (productId <= 0) {
        missingProductIds.push(productId);
        continue;
      }
      try {
        const product = await this.productsService.findOne(productId);
        if (product.stock < totalQuantity) {
          insufficientStockItems.push(`${product.name} (requested: ${totalQuantity}, available: ${product.stock})`);
        } else {
          validatedItems.push({ product, quantity: totalQuantity });
        }
      } catch (err) {
        missingProductIds.push(productId);
      }
    }

    if (missingProductIds.length > 0) {
      throw new BadRequestException(`Products not found: #${missingProductIds.join(', #')}`);
    }

    if (insufficientStockItems.length > 0) {
      throw new BadRequestException(`Not enough stock for: ${insufficientStockItems.join(', ')}`);
    }

    const order = this.ordersRepository.create({
      userId: user.id,
      status: OrderStatus.PENDING,
      total: 0,
    });
    const savedOrder = await this.ordersRepository.save(order);

    let total = 0;
    for (const { product, quantity } of validatedItems) {
      const orderItem = this.orderItemsRepository.create({
        orderId: savedOrder.id,
        productId: product.id,
        quantity,
        price: product.price,
      });

      await this.orderItemsRepository.save(orderItem);
      total += product.price * quantity;
      await this.productsService.updateStock(product.id, product.stock - quantity);
    }

    savedOrder.total = total;
    await this.ordersRepository.save(savedOrder);

    return this.findOne(savedOrder.id);
  }

  async updateStatus(id: number, status: OrderStatus): Promise<Order> {
    let order: Order;
    try {
      order = await this.findOne(id);
    } catch (err) {
      throw new BadRequestException(`Order #${id} does not exist or orderId is invalid`);
    }

    if (status !== OrderStatus.SHIPPED && status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Invalid status "${status}". Valid status options for update are: ${OrderStatus.SHIPPED}, ${OrderStatus.DELIVERED}`,
      );
    }

    if (order.status === status) {
      return order;
    }

    if (status === OrderStatus.SHIPPED && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed orders can be updated to shipped');
    }

    if (status === OrderStatus.DELIVERED && order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('Only shipped orders can be updated to delivered');
    }

    order.status = status;
    return this.ordersRepository.save(order);
  }

  async processPayment(orderId: number): Promise<{ success: boolean; transactionId: string }> {
    const order = await this.findOne(orderId);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Cannot process payment for an order with status "${order.status}"`);
    }
    
    let lastError: Error = new ServiceUnavailableException('Payment service unavailable');
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await paymentService.processPayment(orderId, Number(order.total));
        
        if (result.success) {
          order.status = OrderStatus.CONFIRMED;
          await this.ordersRepository.save(order);
          return result;
        }
      } catch (error: any) {
        lastError = new ServiceUnavailableException(error.message);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    throw lastError;
  }

  async cancel(id: number): Promise<Order> {
    const order = await this.findOne(id);
    
    if (order.status === OrderStatus.CANCELLED) {
      return order;
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }
    
    order.status = OrderStatus.CANCELLED;
    const savedOrder = await this.ordersRepository.save(order);

    for (const item of order.items) {
      const product = await this.productsService.findOne(item.productId);
      await this.productsService.updateStock(product.id, product.stock + item.quantity);
    }
    
    return savedOrder;
  }

  async getOrderWithFullDetails(id: number): Promise<any> {
    if (!id || id <= 0) {
      throw new BadRequestException(`ID parameter "${id}" must be a positive integer greater than 0`);
    }

    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product', 'items.product.category'],
    });
    
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    const enriched: any = { ...order };
    if (order.user) {
      enriched.user = {
        ...order.user,
        latestOrder: {
          id: order.id,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
        },
      };
    }

    return enriched;
  }
}
