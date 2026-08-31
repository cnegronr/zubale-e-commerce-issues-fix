import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ProductsController, CategoriesController } from '../../src/products/products.controller';
import { ProductsService } from '../../src/products/products.service';
import { Product } from '../../src/products/product.entity';
import { Category } from '../../src/products/category.entity';

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;
  let cacheManager: any;
  let productsService: ProductsService;
  let productsRepository: any;

  const mockProduct = {
    id: 1,
    name: 'Gaming Laptop',
    description: 'High performance',
    price: 1500,
    stock: 10,
    isAvailable: true,
    categoryId: 1,
  };

  const mockPhoneProduct = {
    id: 2,
    name: 'Smartphone',
    description: null,
    price: 800,
    stock: 5,
    isAvailable: true,
    categoryId: 1,
  };

  const parentCategory = {
    id: 10,
    name: 'Computers',
    description: 'Hardware',
    parentId: null,
    parent: null,
    children: [],
  };

  const childCategory = {
    id: 2,
    name: 'Laptops',
    description: 'Portable',
    parentId: 1,
    parent: parentCategory,
    children: [],
  };

  const mockCategory = {
    id: 1,
    name: 'Electronics',
    description: 'Tech gadgets',
    parentId: 10,
    parent: parentCategory,
    children: [childCategory],
  };

  beforeEach(async () => {
    const mockProductsRepo = {
      find: jest.fn().mockResolvedValue([mockProduct, mockPhoneProduct]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve(mockProduct);
        if (where.id === 2) return Promise.resolve(mockPhoneProduct);
        return Promise.resolve(null);
      }),
      create: jest.fn((dto) => dto),
      save: jest.fn((p) => Promise.resolve({ ...p, id: 1 })),
      remove: jest.fn().mockResolvedValue(mockProduct),
    };

    const mockCategoriesRepo = {
      find: jest.fn().mockResolvedValue([mockCategory]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve(mockCategory);
        return Promise.resolve(null);
      }),
      create: jest.fn((dto) => dto),
      save: jest.fn((c) => Promise.resolve({ ...c, id: 1 })),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController, CategoriesController],
      providers: [
        ProductsService,
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

    cacheManager = moduleFixture.get(CACHE_MANAGER);
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

    it('GET /products/search?q=laptop - should return cached or searched results', async () => {
      cacheManager.get.mockResolvedValueOnce([mockProduct]);
      await request(app.getHttpServer())
        .get('/products/search?q=laptop')
        .expect(200);

      cacheManager.get.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .get('/products/search?q=laptop')
        .expect(200);

      cacheManager.get.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .get('/products/search?q=Smartphone')
        .expect(200);

      cacheManager.get.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .get('/products/search')
        .expect(200);
    });

    it('GET /products/1 - should return product by id', () => {
      return request(app.getHttpServer())
        .get('/products/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(1);
        });
    });

    it('GET /products/0 - should return 400 Bad Request for positive int pipe failure', async () => {
      await expect(productsService.findOne(0)).rejects.toThrow(BadRequestException);
      await expect(productsService.findCategory(0)).rejects.toThrow(BadRequestException);
      return request(app.getHttpServer())
        .get('/products/0')
        .expect(400);
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

    it('POST /products - should return 400 when categoryId does not exist', () => {
      return request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Gaming Laptop', price: 1500, stock: 10, categoryId: 99 })
        .expect(400);
    });

    it('POST /products/batch - should process batch with success and failure items', async () => {
      await request(app.getHttpServer())
        .post('/products/batch')
        .send({ productIds: [1, 99] })
        .expect(201)
        .expect((res) => {
          expect(res.body.processed).toBe(1);
          expect(res.body.failedProductIds).toContain(99);
        });

      await request(app.getHttpServer())
        .post('/products/batch')
        .send({ productIds: [1, 2] })
        .expect(201)
        .expect((res) => {
          expect(res.body.processed).toBe(2);
          expect(res.body.failedProductIds).toBeUndefined();
        });
    });

    it('POST /products/batch - should return 400 when invalid payload is sent', () => {
      return request(app.getHttpServer())
        .post('/products/batch')
        .send({})
        .expect(400);
    });

    it('updateStock validation - should throw BadRequestException on negative stock', async () => {
      await expect(productsService.updateStock(1, -5)).rejects.toThrow();
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

    it('GET /categories/99 - should return 404 when category not found', () => {
      return request(app.getHttpServer())
        .get('/categories/99')
        .expect(404);
    });

    it('GET /categories/1/tree - should return category tree', () => {
      return request(app.getHttpServer())
        .get('/categories/1/tree')
        .expect(200)
        .expect((res) => {
          expect(res.body.children).toBeDefined();
          expect(res.body.parent).toBeDefined();
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

    it('POST /categories - should return 400 when parentId does not exist (including parentId = 0)', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Laptops', parentId: 99 })
        .expect(400);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Laptops', parentId: 0 })
        .expect(400);
    });
  });
});
