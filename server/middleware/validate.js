import { ZodError } from 'zod';
import { asyncHandler, badRequest } from './error.js';

/**
 * Validate req.body/query/params against a Zod schema and replace the raw
 * value with the parsed (coerced, defaulted) result.
 */
export function validate(schema, source = 'body') {
  return asyncHandler(async (req, _res, next) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      if (source === 'query') {
        // Express 5 makes req.query a read-only getter, so use a dedicated field
        req.validatedQuery = parsed;
      } else {
        req[source] = parsed;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(badRequest('Validation failed', fieldErrorsFrom(err)));
      }
      next(err);
    }
  });
}

function fieldErrorsFrom(err) {
  const out = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}