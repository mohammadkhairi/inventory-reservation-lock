import type { Product } from '../domain/Product.js';

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
}

export class InMemoryProductRepository implements ProductRepository {
  private readonly store = new Map<string, Product>();

  async findById(id: string): Promise<Product | null> {
    return this.store.get(id) ?? null;
  }

  async save(product: Product): Promise<void> {
    this.store.set(product.id, product);
  }
}
