import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './order.entity';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query('userId') userId?: string) {
    if (userId) {
      const uid = parseInt(userId, 10);
      return this.ordersService.findByUser(uid);
    }
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/full')
  getFullDetails(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ordersService.getOrderWithFullDetails(id);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Post(':id/pay')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  processPayment(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ordersService.processPayment(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, status);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ordersService.cancel(id);
  }
}
