import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../../src/products/products.service';
import {
  ProductsController,
  CategoriesController,
} from '../../src/products/products.controller';
import { ParsePositiveIntPipe } from '../../src/common/pipes/parse-positive-int.pipe';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { Product } from '../../src/products/product.entity';
import { Category } from '../../src/products/category.entity';

describe('Products & Categories Integration & Edge-Case Tests', () => {
  let productsService: ProductsService;
  let productsController: ProductsController;
  let categoriesController: CategoriesController;
  let appController: AppController;
  let productsRepository: any;
  let categoriesRepository: any;
  let cacheManager: any;

  const mockProduct = {
    id: 1,
    name: 'Sample Item',
    description: 'Sample desc',
    stock: 10,
    price: 100,
    isAvailable: true,
    categoryId: 1,
  };
  const childCategory = {
    id: 2,
    name: 'Child Cat',
    parentId: 1,
    parent: null,
    children: [],
  };
  const mockCategory = {
    id: 1,
    name: 'Electronics',
    description: 'Gadgets',
    parentId: null,
    parent: null,
    children: [childCategory],
  };

  beforeEach(async () => {
    const mockProductsRepo = {
      find: jest.fn().mockResolvedValue([mockProduct]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve(mockProduct);
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
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController, CategoriesController, AppController],
      providers: [
        ProductsService,
        AppService,
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
    productsController = module.get<ProductsController>(ProductsController);
    categoriesController =
      module.get<CategoriesController>(CategoriesController);
    appController = module.get<AppController>(AppController);
    productsRepository = module.get(getRepositoryToken(Product));
    categoriesRepository = module.get(getRepositoryToken(Category));
    cacheManager = module.get(CACHE_MANAGER);
  });

  describe('AppController & AppService Integration', () => {
    it('returns Hello World!', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('Validation Contract: Negative Stock Prevention (updateStock)', () => {
    it('MUST throw BadRequestException (400 Bad Request) when updating stock to negative value', async () => {
      await expect(productsService.updateStock(1, -10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('MUST throw BadRequestException when product or category id is 0 or negative', async () => {
      const pipe = new ParsePositiveIntPipe();
      expect(pipe.transform('1')).toBe(1);
      expect(() => pipe.transform('0')).toThrow(BadRequestException);
      await expect(productsService.findOne(0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(productsService.findCategory(0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        productsService.create({ name: 'Test', price: 100, categoryId: 0 }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        productsService.createCategory({ name: 'TestCat', parentId: 0 }),
      ).rejects.toThrow(BadRequestException);
      const batchRes = await productsService.processProductBatch([0, -1]);
      expect(batchRes.failedProductIds).toEqual([0, -1]);
    });

    it('updates stock successfully when quantity is positive', async () => {
      const result = await productsService.updateStock(1, 20);
      expect(result.stock).toBe(20);
    });
  });

  describe('Category Tree Safety Contract: Unpopulated Parent Handling (getCategoryTree)', () => {
    it('MUST gracefully build tree when parentId is set but parent relation object is undefined', async () => {
      const orphanCategory: any = {
        id: 1,
        name: 'Orphan Category',
        parentId: 10,
        parent: undefined,
        children: [childCategory],
      };

      jest
        .spyOn(productsService, 'findCategory')
        .mockResolvedValueOnce(orphanCategory);
      const tree = await productsService.getCategoryTree(1);
      expect(tree.children.length).toBe(1);
    });

    it('builds category tree recursively when parent relation is populated', async () => {
      const parentCat: any = {
        id: 10,
        name: 'Parent Cat',
        parentId: null,
        parent: null,
        children: [],
      };
      const childWithParent: any = {
        id: 1,
        name: 'Child Category',
        parentId: 10,
        parent: parentCat,
        children: [],
      };

      jest
        .spyOn(productsService, 'findCategory')
        .mockResolvedValueOnce(childWithParent);
      const tree = await productsService.getCategoryTree(1);
      expect(tree.parent).toBeDefined();
      expect(tree.parent?.id).toBe(10);
    });

    it('builds category tree with empty children array', async () => {
      const noChildrenCat: any = {
        id: 1,
        name: 'No Children',
        parentId: null,
        parent: null,
        children: [],
      };
      jest
        .spyOn(productsService, 'findCategory')
        .mockResolvedValueOnce(noChildrenCat);
      const tree = await productsService.getCategoryTree(1);
      expect(tree.children.length).toBe(0);
    });

    it('builds category tree with undefined children property', async () => {
      const noChildrenCat: any = {
        id: 1,
        name: 'No Children',
        parentId: null,
        parent: null,
        children: undefined,
      };
      jest
        .spyOn(productsService, 'findCategory')
        .mockResolvedValueOnce(noChildrenCat);
      const tree = await productsService.getCategoryTree(1);
      expect(tree.children.length).toBe(0);
    });
  });

  describe('Full Products & Categories Controllers Integration', () => {
    it('ProductsController endpoints and cached search hit', async () => {
      cacheManager.get.mockResolvedValueOnce([mockProduct]);
      expect(await productsController.search('sample')).toEqual([mockProduct]);

      cacheManager.get.mockResolvedValueOnce(null);
      expect(await productsController.search(undefined as any)).toBeDefined();

      expect(await productsController.findAll()).toEqual([mockProduct]);
      expect(await productsController.findOne(1)).toEqual(mockProduct);
      expect(
        await productsController.create({
          name: 'Item',
          price: 10,
          stock: 5,
          categoryId: 1,
        }),
      ).toBeDefined();
      expect(
        await productsController.processBatch({ productIds: [1, 99] }),
      ).toBeDefined();
      await productsController.remove(1);
    });

    it('CategoriesController endpoints', async () => {
      expect(await categoriesController.findAll()).toEqual([mockCategory]);
      expect(await categoriesController.findOne(1)).toEqual(mockCategory);
      expect(await categoriesController.getTree(1)).toBeDefined();
      expect(
        await categoriesController.create({ name: 'Category' }),
      ).toBeDefined();
      expect(
        await categoriesController.create({ name: 'Subcategory', parentId: 1 }),
      ).toBeDefined();
    });

    it('Product / Category Not Found & Batch exceptions', async () => {
      await expect(productsService.findOne(99)).rejects.toThrow(
        NotFoundException,
      );
      await expect(productsService.findCategory(99)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        productsService.create({
          name: 'Invalid',
          price: 10,
          stock: 1,
          categoryId: 99,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        productsService.createCategory({ name: 'Invalid', parentId: 99 }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        productsService.processProductBatch(null as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
