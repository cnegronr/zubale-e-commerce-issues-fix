import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsService } from '../../../src/products/products.service';
import { Product } from '../../../src/products/product.entity';
import { Category } from '../../../src/products/category.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepository: any;
  let categoriesRepository: any;
  let cacheManager: any;

  const mockProduct: any = {
    id: 1,
    name: 'Laptop',
    description: 'Gaming Laptop',
    price: 1500,
    stock: 10,
    isAvailable: true,
    categoryId: 1,
    updatedAt: new Date(),
  };

  const mockCategory: any = {
    id: 1,
    name: 'Electronics',
    description: 'Tech gadgets',
    parentId: null,
    parent: null,
    children: [],
  };

  beforeEach(async () => {
    const mockProductsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };

    const mockCategoriesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
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

    service = module.get<ProductsService>(ProductsService);
    productsRepository = module.get(getRepositoryToken(Product));
    categoriesRepository = module.get(getRepositoryToken(Category));
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all products with category relation', async () => {
      productsRepository.find.mockResolvedValue([mockProduct]);
      const result = await service.findAll();
      expect(result).toEqual([mockProduct]);
      expect(productsRepository.find).toHaveBeenCalledWith({ relations: ['category'] });
    });
  });

  describe('findOne', () => {
    it('should return a product if found', async () => {
      productsRepository.findOne.mockResolvedValue(mockProduct);
      const result = await service.findOne(1);
      expect(result).toEqual(mockProduct);
      expect(productsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category'],
      });
    });

    it('should throw BadRequestException if product id is 0 or negative', async () => {
      await expect(service.findOne(0)).rejects.toThrow(BadRequestException);
      await expect(service.findOne(-1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if product is not found', async () => {
      productsRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and save a product with valid categoryId', async () => {
      const dto = { name: 'Laptop', price: 1500, stock: 10, categoryId: 1 };
      jest.spyOn(service, 'findCategory').mockResolvedValue(mockCategory);
      productsRepository.create.mockReturnValue(mockProduct);
      productsRepository.save.mockResolvedValue(mockProduct);

      const result = await service.create(dto as any);
      expect(result).toEqual(mockProduct);
      expect(service.findCategory).toHaveBeenCalledWith(1);
      expect(productsRepository.create).toHaveBeenCalledWith(dto);
      expect(productsRepository.save).toHaveBeenCalledWith(mockProduct);
    });

    it('should throw BadRequestException if categoryId does not exist', async () => {
      const dto = { name: 'Laptop', price: 1500, stock: 10, categoryId: 99 };
      jest.spyOn(service, 'findCategory').mockRejectedValue(new NotFoundException('Category #99 not found'));

      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if categoryId is 0 or negative', async () => {
      const dto = { name: 'Laptop', price: 1500, stock: 10, categoryId: 0 };
      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStock', () => {
    it('should update stock of a product and save', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockProduct });
      productsRepository.save.mockImplementation(async (p: any) => p);

      const result = await service.updateStock(1, 20);
      expect(result.stock).toBe(20);
      expect(productsRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when quantity is negative', async () => {
      await expect(service.updateStock(1, -5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a product', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockProduct);
      productsRepository.remove.mockResolvedValue(mockProduct);

      await service.remove(1);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(productsRepository.remove).toHaveBeenCalledWith(mockProduct);
    });
  });

  describe('searchProducts', () => {
    it('should return cached search results if available', async () => {
      cacheManager.get.mockResolvedValue([mockProduct]);
      const result = await service.searchProducts('laptop');
      expect(result).toEqual([mockProduct]);
      expect(cacheManager.get).toHaveBeenCalledWith('product-search:laptop');
      expect(productsRepository.find).not.toHaveBeenCalled();
    });

    it('should search products in DB with ILike and cache the result', async () => {
      cacheManager.get.mockResolvedValue(null);
      const productWithDesc = { ...mockProduct, description: 'Gaming Laptop' };
      const productNoDesc = { ...mockProduct, id: 2, name: 'Mouse', description: null };
      productsRepository.find.mockResolvedValue([productWithDesc, productNoDesc]);

      const result = await service.searchProducts('gaming');
      expect(result).toEqual([productWithDesc]);
      expect(cacheManager.set).toHaveBeenCalledWith('product-search:gaming', [productWithDesc], 60000);
    });

    it('should fallback to empty string search when query is undefined', async () => {
      cacheManager.get.mockResolvedValue(null);
      productsRepository.find.mockResolvedValue([mockProduct]);

      const result = await service.searchProducts(undefined as any);
      expect(result).toEqual([mockProduct]);
      expect(cacheManager.set).toHaveBeenCalledWith('product-search:', [mockProduct], 60000);
    });
  });

  describe('findAllCategories', () => {
    it('should return all categories with parent and children relations', async () => {
      categoriesRepository.find.mockResolvedValue([mockCategory]);
      const result = await service.findAllCategories();
      expect(result).toEqual([mockCategory]);
      expect(categoriesRepository.find).toHaveBeenCalledWith({ relations: ['parent', 'children'] });
    });
  });

  describe('findCategory', () => {
    it('should return category if found', async () => {
      categoriesRepository.findOne.mockResolvedValue(mockCategory);
      const result = await service.findCategory(1);
      expect(result).toEqual(mockCategory);
      expect(categoriesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['parent', 'children', 'products'],
      });
    });

    it('should throw BadRequestException if category id is 0 or negative', async () => {
      await expect(service.findCategory(0)).rejects.toThrow(BadRequestException);
      await expect(service.findCategory(-1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if category is not found', async () => {
      categoriesRepository.findOne.mockResolvedValue(null);
      await expect(service.findCategory(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCategory', () => {
    it('should create and save a category with valid parentId', async () => {
      const dto = { name: 'Laptops', parentId: 1 };
      jest.spyOn(service, 'findCategory').mockResolvedValue(mockCategory);
      categoriesRepository.create.mockReturnValue(mockCategory);
      categoriesRepository.save.mockResolvedValue(mockCategory);

      const result = await service.createCategory(dto);
      expect(result).toEqual(mockCategory);
      expect(service.findCategory).toHaveBeenCalledWith(1);
      expect(categoriesRepository.create).toHaveBeenCalledWith(dto);
      expect(categoriesRepository.save).toHaveBeenCalledWith(mockCategory);
    });

    it('should throw BadRequestException if parentId does not exist (e.g. parentId = 0)', async () => {
      const dto = { name: 'Laptops', parentId: 0 };
      await expect(service.createCategory(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if parentId is positive but category does not exist in DB', async () => {
      const dto = { name: 'Laptops', parentId: 99 };
      jest.spyOn(service, 'findCategory').mockRejectedValueOnce(new NotFoundException('Category #99 not found'));
      await expect(service.createCategory(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCategoryTree', () => {
    it('should build category tree including parent and children', async () => {
      const parentCat: any = { id: 10, name: 'Parent', parentId: null, parent: null, children: [] };
      const childCat: any = { id: 2, name: 'Child', parentId: null, parent: null, children: [] };
      const rootCat: any = {
        id: 1,
        name: 'Root',
        parentId: 10,
        parent: parentCat,
        children: [childCat],
      };

      jest.spyOn(service, 'findCategory').mockResolvedValue(rootCat);

      const tree = await service.getCategoryTree(1);
      expect(tree.id).toBe(1);
      expect(tree.parent.id).toBe(10);
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].id).toBe(2);
    });
  });

  describe('processProductBatch', () => {
    it('should process a batch of product IDs', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockProduct });
      productsRepository.save.mockResolvedValue([mockProduct]);

      const result = await service.processProductBatch([1, 2]);
      expect(result).toEqual({ success: true, processed: 2, failedProductIds: undefined });
    });

    it('should handle errors for individual items in batch and report failed IDs', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException('Product #1 not found'));

      const result = await service.processProductBatch([1]);
      expect(result).toEqual({ success: true, processed: 0, failedProductIds: [1] });
    });

    it('should fail-fast for invalid product IDs <= 0 in batch and report failed IDs without querying DB', async () => {
      const result = await service.processProductBatch([0, -1]);
      expect(result).toEqual({ success: true, processed: 0, failedProductIds: [0, -1] });
    });

    it('should throw BadRequestException if outer processing fails or invalid payload is passed', async () => {
      await expect(service.processProductBatch(null as any)).rejects.toThrow(BadRequestException);
    });
  });
});
