export const ErrorCode = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_RESERVATION_STATE: 'INVALID_RESERVATION_STATE',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class DomainError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(id: string) {
    super(ErrorCode.PRODUCT_NOT_FOUND, `Product not found: ${id}`);
  }
}

export class ReservationNotFoundError extends DomainError {
  constructor(id: string) {
    super(ErrorCode.RESERVATION_NOT_FOUND, `Reservation not found: ${id}`);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(params: { available: number; requested: number }) {
    super(
      ErrorCode.INSUFFICIENT_STOCK,
      `Insufficient stock: requested ${params.requested}, only ${params.available} available`,
    );
  }
}

export class InvalidReservationStateError extends DomainError {
  constructor(params: { current: string; attempted: string }) {
    super(
      ErrorCode.INVALID_RESERVATION_STATE,
      `Reservation cannot be ${params.attempted} while in state ${params.current}`,
    );
  }
}

export class InvalidQuantityError extends DomainError {
  constructor(quantity: number) {
    super(ErrorCode.INVALID_QUANTITY, `Quantity must be a positive integer, got ${quantity}`);
  }
}
