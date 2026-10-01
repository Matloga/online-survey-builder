/** Error carrying an HTTP status and optional per-field messages. */
export class ApiError extends Error {
  constructor(statusCode, message, fieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = fieldErrors ? 400 : statusCode;
    this.fieldErrors = fieldErrors;
  }
}

export const badRequest = (msg, fieldErrors) => new ApiError(400, msg, fieldErrors);
export const unauthorized = (msg = 'Not authenticated') => new ApiError(401, msg);
export const forbidden = (msg = 'You do not have access to this resource') => new ApiError(403, msg);
export const notFound = (msg = 'Resource not found') => new ApiError(404, msg);
export const conflict = (msg) => new ApiError(409, msg);

/** Wraps async handlers so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Central error responder. */
export function errorHandler(err, req, res, _next) {
  // ValidationError from the submission service
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message,
      fieldErrors: err.fieldErrors,
    });
  }

  // SQL Server unique index violation -> duplicate submission
  if (err.number === 2601 || err.number === 2627) {
    return res.status(409).json({
      error: 'You have already submitted a response for this survey.',
    });
  }

  if (err.code === 'EREQUEST' && err.message?.includes('CHECK constraint')) {
    return res.status(400).json({ error: 'Invalid data submitted.' });
  }

  if (err.code === 'ELOGIN' || err.code === 'ESOCKET' || err.code === 'ECONNCLOSED') {
    return res.status(503).json({ error: 'Database unavailable. Please try again shortly.' });
  }

  const status = err.statusCode || 500;
  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}