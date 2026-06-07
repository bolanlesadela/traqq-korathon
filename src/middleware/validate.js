/**
 * Validation middleware factory.
 * Wraps a Zod schema and validates req.body against it.
 * On failure, throws — caught by errorHandler as a ZodError → 400.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), authController.register)
 */
export function validate(schema) {
  return (req, res, next) => {
    schema.parse(req.body); // throws ZodError if invalid
    next();
  };
}
