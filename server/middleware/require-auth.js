/**
 * Requires an authenticated session before continuing.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    error: {
      code: 'UNAUTHENTICATED',
      message: 'Login is required.',
    },
  });
}
