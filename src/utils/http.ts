import type { Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

/**
 * Validate a payload against `schema` before sending it. A failure here is a
 * server bug (contract drift between service and API), so it throws a plain
 * Error and lands on the 500 branch of `errorHandler` — not the 400 branch
 * reserved for bad *client* input.
 */
export function sendJson<S extends ZodTypeAny>(params: {
  res: Response;
  schema: S;
  body: unknown;
  status?: number;
}): void {
  const { res, schema, body, status = 200 } = params;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Response validation failed: ${detail}`);
  }
  res.status(status).json(parsed.data as z.infer<S>);
}
