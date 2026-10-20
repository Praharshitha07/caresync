/**
 * Not Found (404) Middleware
 * Catches all unmatched routes and returns a consistent JSON response.
 */
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
