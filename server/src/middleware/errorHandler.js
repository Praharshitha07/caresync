import { env } from '../config/env.js';

/**
 * Centralized Error Handling Middleware
 *
 * Guarantees a consistent JSON error format:
 * {
 *   "success": false,
 *   "message": "..."
 * }
 *
 * Security safeguards:
 * - Never logs or leaks sensitive patient information or request payloads.
 * - Never exposes internal stack traces or raw database error details.
 * - Gracefully intercepts malformed JSON syntax errors.
 */
export function errorHandler(err, req, res, next) {
  // Handle malformed JSON body errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload received',
    });
  }

  const isDatabaseUnavailable =
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerError' ||
    err.name === 'MongoTimeoutError' ||
    err.name === 'MongooseError';
  const isDuplicate = err.code === 11000;
  const isMongooseValidation = err.name === 'ValidationError';
  const isMongooseCast = err.name === 'CastError';
  const statusCode =
    err.statusCode ||
    (isDuplicate
      ? 409
      : isMongooseValidation || isMongooseCast
        ? 400
        : isDatabaseUnavailable
          ? 503
          : 500);
  const isProduction = env.NODE_ENV === 'production';

  const message =
    statusCode < 500
      ? err.statusCode
        ? err.message
        : isDuplicate
          ? 'A patient with a conflicting identifier already exists'
          : isMongooseValidation
            ? 'Data failed validation'
            : 'Request contains an invalid identifier or value'
      : isDatabaseUnavailable
        ? 'Database is temporarily unavailable'
        : 'An internal server error occurred';

  const errorResponse = {
    success: false,
    message,
  };

  if (!isProduction && env.NODE_ENV !== 'test') {
    if (req.path === '/api/dashboard') {
      const validationErrors = isMongooseValidation
        ? Object.entries(err.errors || {}).map(([field, validationError]) => ({
            field,
            kind: validationError.kind,
          }))
        : [];
      console.error('[CareSync dashboard diagnostic]', {
        url: req.originalUrl,
        status: statusCode,
        message: errorResponse.message,
        errorName: err.name || 'Error',
        validationErrors,
      });
    }

    // Log only error type and safe route labels for other protected resources.
    const sensitivePath = [
      '/api/patients',
      '/api/medical-records',
      '/api/appointments',
      '/api/dashboard',
    ].some((prefix) => req.path.startsWith(prefix));
    const path = sensitivePath ? '/api/<protected-resource>' : req.path;
    if (req.path !== '/api/dashboard') {
      console.error(`[Error] ${req.method} ${path}: ${err.name || 'Error'}`);
    }
  }

  res.status(statusCode).json(errorResponse);
}
