import { DomainError, ErrorCode } from '../domain/errors.js';
import { HttpErrorCode, HttpStatus } from './httpStatus.js';

export interface HttpError {
  status: HttpStatus;
  body: { error: { code: string; message: string } };
}

/** Maps a domain error to an HTTP response. Unknown errors surface as 500. */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof DomainError) {
    return {
      status: statusFor(err.code),
      body: { error: { code: err.code, message: err.message } },
    };
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { error: { code: HttpErrorCode.INTERNAL_ERROR, message } },
  };
}

/**
 * Exhaustive mapping — the `never` fallback makes the compiler flag any new
 * ErrorCode that forgets to declare its HTTP status.
 */
function statusFor(code: ErrorCode): HttpStatus {
  switch (code) {
    case ErrorCode.PRODUCT_NOT_FOUND:
    case ErrorCode.RESERVATION_NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    case ErrorCode.INSUFFICIENT_STOCK:
    case ErrorCode.INVALID_RESERVATION_STATE:
      return HttpStatus.CONFLICT;
    case ErrorCode.INVALID_QUANTITY:
      return HttpStatus.BAD_REQUEST;
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}
