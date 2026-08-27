import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from '../../src/products/products.service';
import { Product } from '../../src/products/product.entity';
import { Category } from '../../src/products/category.entity';

describe('Products Cache & Batch Contract Tests', () => {
  let productsService: ProductsService;
  let productsRepository: any;
  let cacheMap: Map<string, any>;

  const laptopProduct = { id: 1, name: 'Gaming Laptop', description: 'Powerful laptop', price: 1500, stock: 10 };
  const phoneProduct = { id: 2, name: 'Smartphone', description: null, price: 800, stock: 20 };

  beforeEach(async () => {
    cacheMap = new Map<string, any>();

    const mockProductsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockCategoriesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn((key: string) => Promise.resolve(cacheMap.get(key))),
      set: jest.fn((key: string, val: any) => {
        cacheMap.set(key, val);
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        cacheMap.delete(key);
        return Promise.resolve();
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
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

    productsService = module.get<ProductsService>(ProductsService);
    productsRepository = module.get(getRepositoryToken(Product));
  });

  describe('Cache Contract: Parameter Isolation Guarantee (searchProducts)', () => {
    it('MUST use query-specific cache keys so searching "phone" does NOT return cached "laptop" results', async () => {
      productsRepository.find.mockResolvedValue([laptopProduct, phoneProduct]);

      // First search for 'laptop'
      const laptopResults = await productsService.searchProducts('laptop');
      expect(laptopResults).toEqual([laptopProduct]);

      // Second search for 'phone' with different query
      const phoneResults = await productsService.searchProducts('phone');

      // Contract assertion: Search for 'phone' MUST return phoneProduct, NOT laptopProduct
      expect(phoneResults).toEqual([phoneProduct]);
    });
  });

  describe('API Contract: Batch Error Reporting Guarantee (processProductBatch)', () => {
    it('MUST return explicit error details/failed IDs when batch items fail', async () => {
      jest.spyOn(productsService, 'findOne').mockImplementation(async (id: number) => {
        if (id === 2) {
          throw new NotFoundException('Product #2 not found');
        }
        return { ...laptopProduct, id, updatedAt: new Date() } as any;
      });
      productsRepository.save.mockImplementation(async (p: any) => p);

      const batchResult = await productsService.processProductBatch([1, 2, 3]);

      // Contract assertion: Batch result MUST include failed item details instead of hiding failures
      expect((batchResult as any).failedItems ?? (batchResult as any).failedProductIds).toBeDefined();
      expect((batchResult as any).failedProductIds ?? (batchResult as any).failedItems).toContain(2);
    });

    it('returns undefined failedProductIds when all batch items succeed', async () => {
      jest.spyOn(productsService, 'findOne').mockImplementation(async (id: number) => {
        return { ...laptopProduct, id, updatedAt: new Date() } as any;
      });
      productsRepository.save.mockImplementation(async (p: any) => p);

      const batchResult = await productsService.processProductBatch([1, 3]);
      expect(batchResult.success).toBe(true);
      expect(batchResult.processed).toBe(2);
      expect(batchResult.failedProductIds).toBeUndefined();
    });
  });
});
