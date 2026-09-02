import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from './product.entity';
import { Category } from './category.entity';
import { CreateProductDto, CreateCategoryDto } from './dto/create-product.dto';

export interface CategoryTreeNode {
  id: number;
  name: string;
  parent?: CategoryTreeNode;
  children: CategoryTreeNode[];
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find({ relations: ['category'] });
  }

  async findOne(id: number): Promise<Product> {
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Product ID must be a positive integer greater than 0',
      );
    }
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    if (
      createProductDto.categoryId !== undefined &&
      createProductDto.categoryId !== null
    ) {
      if (createProductDto.categoryId <= 0) {
        throw new BadRequestException(
          `Cannot create product because category #${createProductDto.categoryId} does not exist`,
        );
      }
      try {
        await this.findCategory(createProductDto.categoryId);
      } catch {
        throw new BadRequestException(
          `Cannot create product because category #${createProductDto.categoryId} does not exist`,
        );
      }
    }
    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async updateStock(id: number, quantity: number): Promise<Product> {
    if (quantity < 0) {
      throw new BadRequestException('Stock quantity cannot be negative');
    }
    const product = await this.findOne(id);
    product.stock = quantity;
    return this.productsRepository.save(product);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepository.remove(product);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const searchQuery = (query || '').trim();
    const cacheKey = `product-search:${searchQuery.toLowerCase()}`;
    const cached = await this.cacheManager.get<Product[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const products = await this.productsRepository.find({
      where: [
        { name: ILike(`%${searchQuery}%`) },
        { description: ILike(`%${searchQuery}%`) },
      ],
      relations: ['category'],
    });

    const results = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description
          ? p.description.toLowerCase().includes(searchQuery.toLowerCase())
          : false),
    );

    await this.cacheManager.set(cacheKey, results, 60000);
    return results;
  }

  async findAllCategories(): Promise<Category[]> {
    return this.categoriesRepository.find({
      relations: ['parent', 'children'],
    });
  }

  async findCategory(id: number): Promise<Category> {
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Category ID must be a positive integer greater than 0',
      );
    }
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'products'],
    });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId <= 0) {
        throw new BadRequestException(
          `Cannot create category because parent category #${dto.parentId} does not exist`,
        );
      }
      try {
        await this.findCategory(dto.parentId);
      } catch {
        throw new BadRequestException(
          `Cannot create category because parent category #${dto.parentId} does not exist`,
        );
      }
    }
    const category = this.categoriesRepository.create(dto);
    return this.categoriesRepository.save(category);
  }

  async getCategoryTree(categoryId: number): Promise<CategoryTreeNode> {
    const category = await this.findCategory(categoryId);
    return this.buildCategoryTree(category);
  }

  private buildCategoryTree(category: Category): CategoryTreeNode {
    const tree: CategoryTreeNode = {
      id: category.id,
      name: category.name,
      children: [],
    };

    if (category.parentId && category.parent) {
      tree.parent = this.buildCategoryTree(category.parent);
    }

    if (category.children && category.children.length > 0) {
      tree.children = category.children.map((child) =>
        this.buildCategoryTree(child),
      );
    }

    return tree;
  }

  async processProductBatch(productIds: number[]): Promise<{
    success: boolean;
    processed: number;
    failedProductIds?: number[];
  }> {
    let processed = 0;
    const failedProductIds: number[] = [];
    const productsToSave: Product[] = [];

    try {
      for (const id of productIds) {
        if (!id || id <= 0) {
          failedProductIds.push(id);
          continue;
        }
        try {
          const product = await this.findOne(id);
          product.updatedAt = new Date();
          productsToSave.push(product);
          processed++;
        } catch {
          failedProductIds.push(id);
        }
      }

      if (productsToSave.length > 0) {
        await this.productsRepository.save(productsToSave);
      }
    } catch {
      throw new BadRequestException('Batch processing failed');
    }

    return {
      success: true,
      processed,
      failedProductIds:
        failedProductIds.length > 0 ? failedProductIds : undefined,
    };
  }
}
