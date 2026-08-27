import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './product.entity';
import { Category } from './category.entity';

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

    it('should throw NotFoundException if product is not found', async () => {
      productsRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and save a product', async () => {
      const dto = { name: 'Laptop', price: 1500, stock: 10, categoryId: 1 };
      productsRepository.create.mockReturnValue(mockProduct);
      productsRepository.save.mockResolvedValue(mockProduct);

      const result = await service.create(dto as any);
      expect(result).toEqual(mockProduct);
      expect(productsRepository.create).toHaveBeenCalledWith(dto);
      expect(productsRepository.save).toHaveBeenCalledWith(mockProduct);
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
      expect(cacheManager.get).toHaveBeenCalledWith('product-search');
      expect(productsRepository.find).not.toHaveBeenCalled();
    });

    it('should filter products by name and description and cache the result', async () => {
      cacheManager.get.mockResolvedValue(null);
      const product1 = { id: 1, name: 'Gadget', description: 'Super laptop device' };
      const product2 = { id: 2, name: 'Phone', description: null };
      const product3 = { id: 3, name: 'Desk', description: 'Wooden desk' };

      productsRepository.find.mockResolvedValue([product1, product2, product3]);

      const result = await service.searchProducts('laptop');
      expect(result).toEqual([product1]);
      expect(cacheManager.set).toHaveBeenCalledWith('product-search', [product1], 60000);
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

    it('should throw NotFoundException if category is not found', async () => {
      categoriesRepository.findOne.mockResolvedValue(null);
      await expect(service.findCategory(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCategory', () => {
    it('should create and save a category', async () => {
      const dto = { name: 'Electronics' };
      categoriesRepository.create.mockReturnValue(mockCategory);
      categoriesRepository.save.mockResolvedValue(mockCategory);

      const result = await service.createCategory(dto);
      expect(result).toEqual(mockCategory);
      expect(categoriesRepository.create).toHaveBeenCalledWith(dto);
      expect(categoriesRepository.save).toHaveBeenCalledWith(mockCategory);
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
      productsRepository.save.mockResolvedValue(mockProduct);

      const result = await service.processProductBatch([1, 2]);
      expect(result).toEqual({ success: true, processed: 2 });
    });

    it('should handle errors for individual items in batch', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException('Product #1 not found'));

      const result = await service.processProductBatch([1]);
      expect(result).toEqual({ success: true, processed: 0 });
    });

    it('should throw BadRequestException if outer processing fails', async () => {
      await expect(service.processProductBatch(null as any)).rejects.toThrow(BadRequestException);
    });
  });
});
