import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { ProductsService } from '../../src/products/products.service';
import { Product } from '../../src/products/product.entity';
import { Category } from '../../src/products/category.entity';

describe('Products & Categories Edge-Case Tests', () => {
  let productsService: ProductsService;
  let productsRepository: any;
  let categoriesRepository: any;

  const mockProduct = { id: 1, name: 'Sample Item', stock: 10, price: 100 };

  beforeEach(async () => {
    const mockProductsRepo = {
      findOne: jest.fn(),
      save: jest.fn((p) => Promise.resolve(p)),
    };

    const mockCategoriesRepo = {
      findOne: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
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
    categoriesRepository = module.get(getRepositoryToken(Category));
  });

  describe('Validation Contract: Negative Stock Prevention (updateStock)', () => {
    it('MUST throw BadRequestException when attempting to set negative stock', async () => {
      jest.spyOn(productsService, 'findOne').mockResolvedValue({ ...mockProduct } as any);

      // Contract assertion: Stock quantity cannot be negative
      await expect(productsService.updateStock(1, -10)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Category Tree Safety Contract: Unpopulated Parent Handling (getCategoryTree)', () => {
    it('MUST gracefully build tree when parentId is set but parent relation object is undefined', async () => {
      // Category has parentId = 10, but parent object is undefined (not loaded by relation)
      const orphanCategory: any = {
        id: 1,
        name: 'Orphan Category',
        parentId: 10,
        parent: undefined,
        children: [],
      };

      jest.spyOn(productsService, 'findCategory').mockResolvedValue(orphanCategory);

      // Contract assertion: getCategoryTree MUST NOT throw TypeError: Cannot read properties of undefined (reading 'id')
      await expect(productsService.getCategoryTree(1)).resolves.not.toThrow();
    });
  });
});
