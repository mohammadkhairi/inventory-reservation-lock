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
 * Domain errors → mapped status + stable code.
 * Zod errors    → 400 with a flattened message.
 * Anything else → 500, logged with stack.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DomainError) {
    res.status(STATUS_BY_CODE[err.code]).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  log.error({ err, requestId: req.requestId }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
}
