import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, CreateCategoryDto } from './dto/create-product.dto';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.productsService.searchProducts(query || '');
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('batch')
  processBatch(@Body() body: { productIds: number[] }) {
    return this.productsService.processProductBatch(body.productIds);
  }

  @Delete(':id')
  remove(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAllCategories();
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.productsService.findCategory(id);
  }

  @Get(':id/tree')
  getTree(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.productsService.getCategoryTree(id);
  }

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.productsService.createCategory(createCategoryDto);
  }
}
