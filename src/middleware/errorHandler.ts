import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { DomainError, ErrorCode } from '../errors.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('errorHandler');

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ErrorCode.PRODUCT_NOT_FOUND]: 404,
  [ErrorCode.RESERVATION_NOT_FOUND]: 404,
  [ErrorCode.INSUFFICIENT_STOCK]: 409,
  [ErrorCode.INVALID_RESERVATION_STATE]: 409,
  [ErrorCode.INVALID_QUANTITY]: 400,
};

/**
 * Terminal Express error middleware. Every route delegates to it via
 * `asyncHandler`, so no route ever writes its own try/catch.
 *
 * Domain errors → mapped status + stable code, logged at warn (expected).
 * Zod errors    → 400 with a flattened message, logged at warn (client bug).
 * Anything else → 500, logged at error with stack (server bug).
 *
 * The logger's pino mixin auto-attaches `requestId` from AsyncLocalStorage,
 * so no need to plumb it in per log call.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof DomainError) {
    log.warn({ err, code: err.code }, 'domain error');
    res.status(STATUS_BY_CODE[err.code]).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    log.warn({ issues: err.issues }, 'validation error');
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  log.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
}
