import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ProductsController, CategoriesController } from '../../src/products/products.controller';
import { ProductsService } from '../../src/products/products.service';
import { Product } from '../../src/products/product.entity';
import { Category } from '../../src/products/category.entity';

describe('ProductsController & CategoriesController (e2e)', () => {
  let app: INestApplication<App>;
  let productsService: jest.Mocked<ProductsService>;

  const mockProduct = {
    id: 1,
    name: 'Gaming Laptop',
    description: 'High performance',
    price: 1500,
    stock: 10,
    isAvailable: true,
    categoryId: 1,
  };

  const mockCategory = {
    id: 1,
    name: 'Electronics',
    description: 'Tech gadgets',
    parentId: null,
  };

  beforeEach(async () => {
    const mockProductsService = {
      findAll: jest.fn().mockResolvedValue([mockProduct]),
      searchProducts: jest.fn().mockResolvedValue([mockProduct]),
      findOne: jest.fn().mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockProduct);
        return Promise.reject(new NotFoundException(`Product #${id} not found`));
      }),
      create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto })),
      processProductBatch: jest.fn().mockResolvedValue({ success: true, processed: 2 }),
      remove: jest.fn().mockResolvedValue(undefined),
      findAllCategories: jest.fn().mockResolvedValue([mockCategory]),
      findCategory: jest.fn().mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockCategory);
        return Promise.reject(new NotFoundException(`Category #${id} not found`));
      }),
      getCategoryTree: jest.fn().mockResolvedValue({ id: 1, name: 'Electronics', children: [] }),
      createCategory: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto })),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController, CategoriesController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Category),
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

    productsService = moduleFixture.get(ProductsService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/products endpoints', () => {
    it('GET /products - should return all products', () => {
      return request(app.getHttpServer())
        .get('/products')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].name).toBe('Gaming Laptop');
        });
    });

    it('GET /products/search?q=laptop - should return search results', () => {
      return request(app.getHttpServer())
        .get('/products/search?q=laptop')
        .expect(200)
        .expect((res) => {
          expect(productsService.searchProducts).toHaveBeenCalledWith('laptop');
        });
    });

    it('GET /products/1 - should return product by id', () => {
      return request(app.getHttpServer())
        .get('/products/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(1);
        });
    });

    it('GET /products/99 - should return 404 if product not found', () => {
      return request(app.getHttpServer())
        .get('/products/99')
        .expect(404);
    });

    it('POST /products - should create a product', () => {
      return request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Gaming Laptop', price: 1500, stock: 10, categoryId: 1 })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Gaming Laptop');
        });
    });

    it('POST /products/batch - should process batch', () => {
      return request(app.getHttpServer())
        .post('/products/batch')
        .send({ productIds: [1, 2] })
        .expect(201)
        .expect((res) => {
          expect(res.body.processed).toBe(2);
        });
    });

    it('DELETE /products/1 - should delete product', () => {
      return request(app.getHttpServer())
        .delete('/products/1')
        .expect(200);
    });
  });

  describe('/categories endpoints', () => {
    it('GET /categories - should return all categories', () => {
      return request(app.getHttpServer())
        .get('/categories')
        .expect(200)
        .expect((res) => {
          expect(res.body[0].name).toBe('Electronics');
        });
    });

    it('GET /categories/1 - should return category by id', () => {
      return request(app.getHttpServer())
        .get('/categories/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(1);
        });
    });

    it('GET /categories/1/tree - should return category tree', () => {
      return request(app.getHttpServer())
        .get('/categories/1/tree')
        .expect(200)
        .expect((res) => {
          expect(res.body.children).toBeDefined();
        });
    });

    it('POST /categories - should create a category', () => {
      return request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Electronics', description: 'Gadgets' })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Electronics');
        });
    });
  });
});
