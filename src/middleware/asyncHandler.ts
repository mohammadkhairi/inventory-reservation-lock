import type { NextFunction, Request, Response } from 'express';

/**
 * Wraps an async route handler so thrown/rejected errors flow to
 * `errorHandler`. Express 4 doesn't do this natively.
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response) => Promise<T>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
