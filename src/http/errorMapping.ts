import { DomainError } from '../domain/errors.js';

export interface HttpError {
  status: number;
  body: { error: { code: string; message: string } };
}

/** Maps a domain error to an HTTP response. Unknown errors surface as 500. */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof DomainError) {
    return { status: statusFor(err.code), body: { error: { code: err.code, message: err.message } } };
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message } },
  };
}

function statusFor(code: string): number {
  switch (code) {
    case 'PRODUCT_NOT_FOUND':
    case 'RESERVATION_NOT_FOUND':
      return 404;
    case 'INSUFFICIENT_STOCK':
      return 409;
    case 'INVALID_RESERVATION_STATE':
      return 409;
    case 'INVALID_QUANTITY':
      return 400;
    default:
      return 500;
  }
}
