export class DomainError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super('PRODUCT_NOT_FOUND', `Product not found: ${productId}`);
  }
}

export class ReservationNotFoundError extends DomainError {
  constructor(reservationId: string) {
    super('RESERVATION_NOT_FOUND', `Reservation not found: ${reservationId}`);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(available: number, requested: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Insufficient stock: requested ${requested}, only ${available} available`,
    );
  }
}

export class InvalidReservationStateError extends DomainError {
  constructor(currentState: string, attempted: string) {
    super(
      'INVALID_RESERVATION_STATE',
      `Cannot ${attempted} a reservation in state ${currentState}`,
    );
  }
}

export class InvalidQuantityError extends DomainError {
  constructor(quantity: number) {
    super('INVALID_QUANTITY', `Quantity must be a positive integer, got ${quantity}`);
  }
}
