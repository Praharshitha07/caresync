export function validateRequest(schema, source, target) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Request validation failed',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req[target] = parsed.data;
    return next();
  };
}
