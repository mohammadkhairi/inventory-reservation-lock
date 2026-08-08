export interface Product {
  readonly id: string;
  readonly name: string;
  readonly totalStock: number;
}

export interface CreateProductInput {
  id: string;
  name: string;
  totalStock: number;
}

export function createProduct(input: CreateProductInput): Product {
  if (!input.id) throw new Error('Product.id is required');
  if (!input.name) throw new Error('Product.name is required');
  if (!Number.isInteger(input.totalStock) || input.totalStock < 0) {
    throw new Error('Product.totalStock must be a non-negative integer');
  }
  return { id: input.id, name: input.name, totalStock: input.totalStock };
}
