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
            ? 'Patient data failed validation'
            : 'Request contains an invalid identifier or value'
      : isDatabaseUnavailable
        ? 'Database is temporarily unavailable'
        : 'An internal server error occurred';

  // Log error type only; driver messages and request data may contain sensitive values.
  if (!isProduction && env.NODE_ENV !== 'test') {
    const sensitivePath = [
      '/api/patients',
      '/api/medical-records',
      '/api/appointments',
    ].some((prefix) => req.path.startsWith(prefix));
    const path = sensitivePath ? '/api/<protected-resource>' : req.path;
    console.error(`[Error] ${req.method} ${path}: ${err.name || 'Error'}`);
  }

  const errorResponse = {
    success: false,
    message,
  };

  res.status(statusCode).json(errorResponse);
}
