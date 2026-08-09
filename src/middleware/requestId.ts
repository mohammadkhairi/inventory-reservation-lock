import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runInLogContext } from '../utils/logContext.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Reads the inbound `x-request-id` header if present (capped at 128 chars to
 * prevent log bloat), otherwise mints a UUID. Sets it on the response too so
 * clients can correlate.
 *
 * Also wraps the rest of the request pipeline in an AsyncLocalStorage log
 * context so every downstream log line automatically carries `requestId`.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  runInLogContext({ requestId: id }, () => next());
}
