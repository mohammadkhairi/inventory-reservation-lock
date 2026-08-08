import type { NextFunction, Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';

const log = createLogger('http');

/**
 * Logs one line per completed request. Fires on `finish` so the status code
 * and duration are known. Skips /health to avoid drowning the log in probes.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    log.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
      },
      `${req.method} ${req.originalUrl}`,
    );
  });
  next();
}
