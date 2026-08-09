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
  public readonly productId: string;

  constructor(productId: string) {
    super(ErrorCode.PRODUCT_NOT_FOUND, `Product not found: ${productId}`);
    this.productId = productId;
  }
}

export class ReservationNotFoundError extends DomainError {
  public readonly reservationId: string;

  constructor(reservationId: string) {
    super(ErrorCode.RESERVATION_NOT_FOUND, `Reservation not found: ${reservationId}`);
    this.reservationId = reservationId;
  }
}

export class InsufficientStockError extends DomainError {
  public readonly productId: string;
  public readonly available: number;
  public readonly requested: number;

  constructor(params: { productId: string; available: number; requested: number }) {
    super(
      ErrorCode.INSUFFICIENT_STOCK,
      `Insufficient stock for ${params.productId}: requested ${params.requested}, only ${params.available} available`,
    );
    this.productId = params.productId;
    this.available = params.available;
    this.requested = params.requested;
  }
}

export class InvalidReservationStateError extends DomainError {
  public readonly reservationId: string;
  public readonly current: string;
  public readonly attempted: string;

  constructor(params: { reservationId: string; current: string; attempted: string }) {
    super(
      ErrorCode.INVALID_RESERVATION_STATE,
      `Reservation ${params.reservationId} cannot be ${params.attempted} while in state ${params.current}`,
    );
    this.reservationId = params.reservationId;
    this.current = params.current;
    this.attempted = params.attempted;
  }
}

export class InvalidQuantityError extends DomainError {
  public readonly quantity: number;

  constructor(quantity: number) {
    super(ErrorCode.INVALID_QUANTITY, `Quantity must be a positive integer, got ${quantity}`);
    this.quantity = quantity;
  }
}
