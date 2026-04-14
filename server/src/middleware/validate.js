import { ZodError } from 'zod';

export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues || err.errors || [];
        const details = issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        // Put first error into the top-level message so frontend toasts show something useful
        const first = details[0];
        const message = first
          ? `${first.field}: ${first.message}`
          : 'Validation failed';
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message,
            details,
          },
        });
      }
      next(err);
    }
  };
}
