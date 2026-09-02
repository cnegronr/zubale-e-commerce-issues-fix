import { Test, TestingModule } from '@nestjs/testing';
import {
  ProductsController,
  CategoriesController,
} from '../../../src/products/products.controller';
import { ProductsService } from '../../../src/products/products.service';
import {
  CreateProductDto,
  CreateCategoryDto,
} from '../../../src/products/dto/create-product.dto';

describe('ProductsController & CategoriesController', () => {
  let productsController: ProductsController;
  let categoriesController: CategoriesController;
  let service: jest.Mocked<ProductsService>;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    description: 'Description',
    price: 10,
    stock: 100,
    isAvailable: true,
    categoryId: 1,
  };

  const mockCategory = {
    id: 1,
    name: 'Test Category',
    description: 'Category Description',
    parentId: null,
  };

  beforeEach(async () => {
    const mockProductsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      updateStock: jest.fn(),
      remove: jest.fn(),
      searchProducts: jest.fn(),
      findAllCategories: jest.fn(),
      findCategory: jest.fn(),
      createCategory: jest.fn(),
      getCategoryTree: jest.fn(),
      processProductBatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController, CategoriesController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    productsController = module.get<ProductsController>(ProductsController);
    categoriesController =
      module.get<CategoriesController>(CategoriesController);
    service = module.get(ProductsService);
  });

  describe('ProductsController', () => {
    it('should be defined', () => {
      expect(productsController).toBeDefined();
    });

    it('findAll', async () => {
      service.findAll.mockResolvedValue([mockProduct as any]);
      expect(await productsController.findAll()).toEqual([mockProduct]);
    });

    it('search with query', async () => {
      service.searchProducts.mockResolvedValue([mockProduct as any]);
      expect(await productsController.search('test')).toEqual([mockProduct]);
      expect(service.searchProducts).toHaveBeenCalledWith('test');
    });

    it('search with undefined query (fallback to empty string)', async () => {
      service.searchProducts.mockResolvedValue([mockProduct as any]);
      expect(await productsController.search(undefined as any)).toEqual([
        mockProduct,
      ]);
      expect(service.searchProducts).toHaveBeenCalledWith('');
    });

    it('findOne', async () => {
      service.findOne.mockResolvedValue(mockProduct as any);
      expect(await productsController.findOne(1)).toEqual(mockProduct);
    });

    it('create', async () => {
      const dto: CreateProductDto = {
        name: 'Test',
        price: 10,
        stock: 100,
        categoryId: 1,
      };
      service.create.mockResolvedValue(mockProduct as any);
      expect(await productsController.create(dto)).toEqual(mockProduct);
    });

    it('processBatch', async () => {
      const body = { productIds: [1, 2] };
      const batchResult = { success: true, processed: 2 };
      service.processProductBatch.mockResolvedValue(batchResult);
      expect(await productsController.processBatch(body)).toEqual(batchResult);
      expect(service.processProductBatch).toHaveBeenCalledWith([1, 2]);
    });

    it('remove', async () => {
      service.remove.mockResolvedValue(undefined);
      await productsController.remove(1);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('CategoriesController', () => {
    it('should be defined', () => {
      expect(categoriesController).toBeDefined();
    });

    it('findAll', async () => {
      service.findAllCategories.mockResolvedValue([mockCategory as any]);
      expect(await categoriesController.findAll()).toEqual([mockCategory]);
    });

    it('findOne', async () => {
      service.findCategory.mockResolvedValue(mockCategory as any);
      expect(await categoriesController.findOne(1)).toEqual(mockCategory);
    });

    it('getTree', async () => {
      const tree = { id: 1, name: 'Test Category', children: [] };
      service.getCategoryTree.mockResolvedValue(tree);
      expect(await categoriesController.getTree(1)).toEqual(tree);
    });

    it('create', async () => {
      const dto: CreateCategoryDto = { name: 'Cat' };
      service.createCategory.mockResolvedValue(mockCategory as any);
      expect(await categoriesController.create(dto)).toEqual(mockCategory);
    });
  });
});
